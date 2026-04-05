'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/lib/context'
import {
  User, Mail, Shield, Lock, Eye, EyeOff, Check, X,
  Save, Camera, Building2, BadgeCheck, Pencil, Key, Phone, FileText, Clock
} from 'lucide-react'

interface UserProfile {
  bio: string
  telefone: string
  unidade: string
  foto: string
}

// ── Senha storage (mesmo do login) ─────────────────────────────────────────────
const PASS_KEY = 'edu-user-passwords'
function getSenhas(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PASS_KEY) ?? '{}') } catch { return {} }
}
function setSenha(uid: string, senha: string) {
  const all = getSenhas(); all[uid] = senha; localStorage.setItem(PASS_KEY, JSON.stringify(all))
}
function verificarSenha(uid: string, senha: string): boolean { return getSenhas()[uid] === senha }

// ── Extra profile storage (por userId) ─────────────────────────────────────────
function getProfileExtra(userId: string): UserProfile {
  try { return JSON.parse(localStorage.getItem(`edu-profile-extra-${userId}`) ?? 'null') ?? { bio: '', telefone: '', unidade: '', foto: '' } } catch { return { bio: '', telefone: '', unidade: '', foto: '' } }
}
function setProfileExtra(userId: string, data: UserProfile) {
  localStorage.setItem(`edu-profile-extra-${userId}`, JSON.stringify(data))
}

function PasswordStrength({ pw }: { pw: string }) {
  const checks = [
    { label: 'Mínimo 8 caracteres',  ok: pw.length >= 8 },
    { label: 'Letra maiúscula',      ok: /[A-Z]/.test(pw) },
    { label: 'Letra minúscula',      ok: /[a-z]/.test(pw) },
    { label: 'Número',               ok: /\d/.test(pw) },
    { label: 'Caractere especial',   ok: /[^a-zA-Z0-9]/.test(pw) },
  ]
  const score = checks.filter(c => c.ok).length
  const color = score <= 1 ? '#ef4444' : score <= 3 ? '#f59e0b' : '#10b981'
  const label = score <= 1 ? 'Muito fraca' : score <= 2 ? 'Fraca' : score <= 3 ? 'Razoável' : score === 4 ? 'Forte' : 'Muito forte'
  if (!pw) return null
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= score ? color : 'hsl(var(--bg-overlay))' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color }}>Força: {label}</span>
        <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{score}/5 critérios</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {checks.map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            {c.ok ? <Check size={10} color="#10b981" /> : <X size={10} color="#6b7280" />}
            <span style={{ color: c.ok ? '#10b981' : 'hsl(var(--text-muted))' }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MeuPerfilPage() {
  const { currentUser, currentUserPerfil } = useApp()

  // ── Extra fields (editáveis pelo usuário)
  const [extra, setExtra] = useState<UserProfile>({ bio: '', telefone: '', unidade: '', foto: '' })
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<UserProfile>(extra)
  const [saved, setSaved] = useState(false)

  // ── Senha
  const [pwForm, setPwForm] = useState({ atual: '', nova: '', confirmar: '' })
  const [showPw, setShowPw] = useState({ atual: false, nova: false, confirmar: false })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  // Carrega o extra profile quando o usuário muda
  useEffect(() => {
    if (!currentUser) return
    const loaded = getProfileExtra(currentUser.id)
    setExtra(loaded)
    setForm(loaded)
  }, [currentUser?.id])

  const saveProfile = () => {
    if (!currentUser) return
    setProfileExtra(currentUser.id, form)
    setExtra(form)
    setEditMode(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const changePw = () => {
    if (!currentUser) return
    setPwError('')
    if (!pwForm.atual) return setPwError('Informe a senha atual')
    if (!verificarSenha(currentUser.id, pwForm.atual)) return setPwError('Senha atual incorreta')
    if (pwForm.nova.length < 8) return setPwError('Nova senha deve ter ao menos 8 caracteres')
    if (pwForm.nova !== pwForm.confirmar) return setPwError('As senhas não coincidem')
    setSenha(currentUser.id, pwForm.nova)
    setPwSuccess(true)
    setPwForm({ atual: '', nova: '', confirmar: '' })
    setTimeout(() => setPwSuccess(false), 4000)
  }

  const getInitials = (nome: string) =>
    nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')

  // Dados exibidos — da conta real
  const displayNome   = currentUser?.nome   ?? '—'
  const displayEmail  = currentUser?.email  ?? '—'
  const displayCargo  = currentUser?.cargo  ?? currentUserPerfil
  const displayPerfil = currentUser?.perfil ?? currentUserPerfil
  const initials      = getInitials(displayNome)

  if (!currentUser) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'hsl(var(--text-muted))' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Nenhum usuário logado</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Faça login para acessar seu perfil.</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Meu Perfil</h1>
          <p className="page-subtitle">Gerencie suas informações pessoais e configurações de conta</p>
        </div>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, color: '#10b981', fontSize: 13, fontWeight: 600 }}>
            <Check size={14} />Perfil salvo com sucesso!
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>

        {/* ── SIDEBAR ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Avatar card */}
          <div className="card" style={{ padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
              {extra.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={extra.foto} alt={displayNome} style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(96,165,250,0.3)' }} />
              ) : (
                <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#fff', margin: '0 auto', boxShadow: '0 0 0 4px rgba(99,102,241,0.15)' }}>
                  {initials || '?'}
                </div>
              )}
              {/* Upload foto */}
              <label style={{ position: 'absolute', bottom: 0, right: -4, width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                <Camera size={13} color="#fff" />
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = ev => {
                    const foto = ev.target?.result as string
                    setForm(p => ({ ...p, foto }))
                    // Salva direto ao trocar foto
                    const updated = { ...getProfileExtra(currentUser.id), foto }
                    setProfileExtra(currentUser.id, updated)
                    setExtra(updated)
                  }
                  reader.readAsDataURL(file)
                }} />
              </label>
            </div>

            <div style={{ fontWeight: 800, fontSize: 17 }}>{displayNome}</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{displayCargo}</div>
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Shield size={10} />{displayPerfil}
              </span>
            </div>
            {extra.bio && (
              <div style={{ marginTop: 14, fontSize: 12, color: 'hsl(var(--text-secondary))', fontStyle: 'italic', lineHeight: 1.5, padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
                &quot;{extra.bio}&quot;
              </div>
            )}
          </div>

          {/* Info rápida */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 12, letterSpacing: '0.06em' }}>INFORMAÇÕES DA CONTA</div>
            {[
              { icon: <Mail size={13} />,      label: 'E-mail',        value: displayEmail },
              { icon: <BadgeCheck size={13} />, label: 'Perfil',        value: displayPerfil },
              { icon: <Building2 size={13} />, label: 'Unidade',       value: extra.unidade || '—' },
              { icon: <Phone size={13} />,     label: 'Telefone',      value: extra.telefone || '—' },
              { icon: <Clock size={13} />,     label: 'Último acesso', value: 'Agora' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ color: 'hsl(var(--text-muted))', marginTop: 1, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, wordBreak: 'break-all' }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CONTEÚDO PRINCIPAL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Identificação — somente leitura (vem do cadastro do sistema) */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={16} color="#60a5fa" /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Identificação da Conta</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Dados gerenciados pelo administrador do sistema</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { label: 'Nome completo',  value: displayNome },
                { label: 'E-mail',         value: displayEmail },
                { label: 'Cargo / Função', value: displayCargo },
                { label: 'Perfil de acesso', value: displayPerfil },
              ].map(f => (
                <div key={f.label} style={{ padding: '12px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em' }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{f.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', fontSize: 11, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}>
              🔒 Para alterar nome, e-mail ou cargo, contate o administrador do sistema.
            </div>
          </div>

          {/* Informações complementares — editáveis */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={16} color="#34d399" /></div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Informações Complementares</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Telefone, unidade e bio — você pode editar</div>
                </div>
              </div>
              {!editMode ? (
                <button className="btn btn-secondary btn-sm" onClick={() => { setForm(extra); setEditMode(true) }}><Pencil size={12} />Editar</button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(false)}><X size={12} />Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={saveProfile}><Save size={12} />Salvar</button>
                </div>
              )}
            </div>

            {editMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="form-label">Telefone</label>
                    <input className="form-input" value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 98888-0000" />
                  </div>
                  <div>
                    <label className="form-label">Unidade de trabalho</label>
                    <input className="form-input" value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))} placeholder="Ex: Unidade Centro" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Bio / Descrição</label>
                  <textarea className="form-input" rows={3} value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="Uma breve descrição sobre você..." style={{ resize: 'vertical' }} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Telefone', value: extra.telefone || '—' },
                  { label: 'Unidade de trabalho', value: extra.unidade || '—' },
                  { label: 'Bio', value: extra.bio || '—' },
                ].map(f => (
                  <div key={f.label} style={{ padding: '12px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 4, fontWeight: 600 }}>{f.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{f.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trocar senha */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Key size={16} color="#ef4444" /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Segurança — Trocar Senha</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Mantenha sua conta protegida com uma senha forte</div>
              </div>
            </div>

            {pwSuccess && (
              <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, color: '#10b981', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Check size={14} />Senha alterada com sucesso!
              </div>
            )}
            {pwError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', fontSize: 12, marginBottom: 14 }}>
                ⚠️ {pwError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Senha atual */}
              <div>
                <label className="form-label">Senha atual</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <input className="form-input" type={showPw.atual ? 'text' : 'password'} value={pwForm.atual}
                    onChange={e => setPwForm(p => ({ ...p, atual: e.target.value }))} placeholder="Digite a senha atual"
                    style={{ paddingLeft: 36, paddingRight: 40 }} />
                  <button type="button" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }} onClick={() => setShowPw(p => ({ ...p, atual: !p.atual }))}>
                    {showPw.atual ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Nova senha */}
              <div>
                <label className="form-label">Nova senha</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <input className="form-input" type={showPw.nova ? 'text' : 'password'} value={pwForm.nova}
                    onChange={e => setPwForm(p => ({ ...p, nova: e.target.value }))} placeholder="Mínimo 8 caracteres"
                    style={{ paddingLeft: 36, paddingRight: 40 }} />
                  <button type="button" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }} onClick={() => setShowPw(p => ({ ...p, nova: !p.nova }))}>
                    {showPw.nova ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <PasswordStrength pw={pwForm.nova} />
              </div>

              {/* Confirmar */}
              <div>
                <label className="form-label">Confirmar nova senha</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <input className="form-input" type={showPw.confirmar ? 'text' : 'password'} value={pwForm.confirmar}
                    onChange={e => setPwForm(p => ({ ...p, confirmar: e.target.value }))} placeholder="Repita a nova senha"
                    style={{ paddingLeft: 36, paddingRight: 40, borderColor: pwForm.confirmar && pwForm.confirmar !== pwForm.nova ? '#ef4444' : undefined }} />
                  <button type="button" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }} onClick={() => setShowPw(p => ({ ...p, confirmar: !p.confirmar }))}>
                    {showPw.confirmar ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {pwForm.confirmar && pwForm.nova !== pwForm.confirmar && (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠️ As senhas não coincidem</div>
                )}
                {pwForm.confirmar && pwForm.nova === pwForm.confirmar && pwForm.nova && (
                  <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={10} />Senhas coincidem</div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={changePw} disabled={!pwForm.atual || !pwForm.nova || !pwForm.confirmar}>
                  <Key size={13} />Alterar Senha
                </button>
              </div>
            </div>
          </div>

          {/* Sessão */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Shield size={16} color="#6366f1" />
              <div style={{ fontWeight: 700, fontSize: 14 }}>Sessão Atual</div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Usuário',   value: displayEmail },
                { label: 'Perfil',    value: displayPerfil },
                { label: 'Plataforma', value: 'Web Browser' },
                { label: 'Acesso',    value: 'Ativo agora' },
              ].map(item => (
                <div key={item.label} style={{ flex: '1 0 160px', padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, wordBreak: 'break-all' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
