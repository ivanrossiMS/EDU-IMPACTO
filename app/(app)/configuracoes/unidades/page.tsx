'use client'

import { useState, useRef, useEffect } from 'react'
import { Building2, Plus, Edit2, Trash2, ChevronDown, ChevronRight, MapPin, Phone, Mail, Globe, Users, BookOpen, Save, X, Upload, CheckCircle } from 'lucide-react'
import { useData, Mantenedor, Unidade, newId } from '@/lib/dataContext'
import UnidadeWizard, { BLANK_UNIDADE } from '@/components/configuracoes/UnidadeWizard'
import { CepAddressFields } from '@/components/ui/CepInput'
import { compressImage } from '@/lib/imageUtils'

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const emptyMantenedor = (): Omit<Mantenedor, 'id' | 'unidades'> => ({
  nome: '', razaoSocial: '', cnpj: '',
  endereco: '', numero: '', bairro: '',
  cidade: '', estado: 'SP', cep: '',
  telefone: '', email: '', responsavel: '', cargo: '',
  website: '', logo: null,
})

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 18, width: '100%', maxWidth: 620, maxHeight: '92vh', overflow: 'auto', border: '1px solid hsl(var(--border-default))', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'hsl(var(--bg-surface))', zIndex: 1, borderRadius: '18px 18px 0 0' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={16} /></button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

function MantenedorForm({ data, onChange, logoRef, onLogoUpload }: {
  data: Omit<Mantenedor, 'id' | 'unidades'>
  onChange: (d: typeof data) => void
  logoRef: React.RefObject<HTMLInputElement | null>
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const f = (field: keyof typeof data) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...data, [field]: e.target.value })
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Logo upload strip */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px',background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
        <div
          onClick={() => logoRef.current?.click()}
          style={{ width: 72, height: 72, borderRadius: 12, background: data.logo ? 'transparent' : 'hsl(var(--bg-overlay))', border: `2px dashed ${data.logo ? '#10b981' : 'hsl(var(--border-default))'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
          {data.logo ? <img src={data.logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} /> : <Upload size={20} color="hsl(var(--text-muted))" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Logo da Rede / Mantenedora</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>Aparecerá nos documentos e no sistema. Recomendado: PNG 300×100px</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => logoRef.current?.click()}><Upload size={11} />Carregar logo</button>
            {data.logo && <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={() => onChange({ ...data, logo: null })}>✕ Remover</button>}
          </div>
        </div>
        <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onLogoUpload} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Nome / Fantasia" required><input className="form-input" value={data.nome} onChange={f('nome')} placeholder="Grupo Educacional..." /></Field>
        <Field label="Telefone"><input className="form-input" value={data.telefone} onChange={f('telefone')} placeholder="(11) 0000-0000" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="E-mail"><input className="form-input" type="email" value={data.email} onChange={f('email')} placeholder="contato@rede.com.br" /></Field>
        <Field label="Site"><input className="form-input" value={data.website} onChange={f('website')} placeholder="www.rede.com.br" /></Field>
      </div>

      <div style={{ height: 1, background: 'hsl(var(--border-subtle))' }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📍 Endereço</div>

      <CepAddressFields
        cep={data.cep}
        logradouro={data.endereco}
        numero={data.numero}
        complemento={''}
        bairro={data.bairro}
        cidade={data.cidade}
        estado={data.estado}
        showComplemento={false}
        onChange={(field, value) => {
          const map: Record<string, string> = {
            cep: 'cep', logradouro: 'endereco', numero: 'numero',
            bairro: 'bairro', cidade: 'cidade', estado: 'estado',
          }
          if (map[field]) onChange({ ...data, [map[field]]: value })
        }}
      />

      <div style={{ height: 1, background: 'hsl(var(--border-subtle))' }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👤 Responsável</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Nome do responsável" required><input className="form-input" value={data.responsavel} onChange={f('responsavel')} placeholder="Dr. / Dra. ..." /></Field>
        <Field label="Cargo"><input className="form-input" value={data.cargo} onChange={f('cargo')} placeholder="Presidente / Diretor..." /></Field>
      </div>
    </div>
  )
}

export default function MultiUnidadesPage() {
  const { mantenedores, setMantenedores } = useData()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState(false)

  // ─ One-time migration: backfill missing 'codigo' for existing units ─
  useEffect(() => {
    const year = new Date().getFullYear()
    const needsMigration = mantenedores.some(m => m.unidades.some(u => !u.codigo))
    if (!needsMigration) return
    setMantenedores(prev => prev.map(m => ({
      ...m,
      unidades: m.unidades.map(u => u.codigo ? u : { ...u, codigo: `UNI-${year}-${Math.random().toString(36).slice(2,6).toUpperCase()}` })
    })))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  type ModalType = 'addMantenedor' | 'editMantenedor' | null
  const [modal, setModal] = useState<ModalType>(null)
  const [editingMantenedorId, setEditingMantenedorId] = useState<string | null>(null)
  const [formMantenedor, setFormMantenedor] = useState(emptyMantenedor())
  const logoRef = useRef<HTMLInputElement | null>(null)

  /* ── Unidade wizard state ── */
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMantenedorId, setWizardMantenedorId] = useState<string | null>(null)
  const [wizardEditingId, setWizardEditingId] = useState<string | null>(null)
  const [wizardInitial, setWizardInitial] = useState<Omit<Unidade, 'id' | 'mantenedorId'> | undefined>(undefined)
  const [wizardCodigo, setWizardCodigo] = useState<string | undefined>(undefined)

  /* Confirm delete */
  const [confirmId, setConfirmId] = useState<{ type: 'mantenedor' | 'unidade'; mId: string; uId?: string } | null>(null)

  /* ── KPIs ── */
  const totalAlunos = mantenedores.flatMap(m => m.unidades).reduce((s, u) => s + (u.alunosAtivos || 0), 0)
  const totalUnidades = mantenedores.flatMap(m => m.unidades).length

  const toggleExpanded = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const result = ev.target?.result as string
      const compressed = await compressImage(result, 400, 400)
      setFormMantenedor(prev => ({ ...prev, logo: compressed }))
    }
    reader.readAsDataURL(file)
  }

  /* ── Mantenedor CRUD ── */
  const openAddMantenedor = () => { setFormMantenedor(emptyMantenedor()); setModal('addMantenedor') }
  const openEditMantenedor = (m: Mantenedor) => {
    const { id, unidades, ...rest } = m
    setFormMantenedor(rest)
    setEditingMantenedorId(id)
    setModal('editMantenedor')
  }
  const saveMantenedor = () => {
    if (!formMantenedor.nome.trim() || !formMantenedor.responsavel.trim()) return
    if (modal === 'addMantenedor') {
      const newM: Mantenedor = { ...formMantenedor, id: newId('M'), unidades: [] }
      setMantenedores(prev => [...prev, newM])
      setExpanded(prev => new Set([...prev, newM.id]))
    } else if (editingMantenedorId) {
      setMantenedores(prev => prev.map(m => m.id === editingMantenedorId ? { ...m, ...formMantenedor } : m))
    }
    setSaved(true); setTimeout(() => setSaved(false), 2000)
    setModal(null)
  }

  /* ── Unidade CRUD via wizard ── */
  const openAddUnidade = (mId: string) => {
    setWizardMantenedorId(mId)
    setWizardEditingId(null)
    setWizardInitial(undefined)
    setWizardCodigo(undefined)
    setWizardOpen(true)
  }
  const openEditUnidade = (mId: string, u: Unidade) => {
    const { id, mantenedorId, ...rest } = u
    setWizardMantenedorId(mId)
    setWizardEditingId(id)
    setWizardInitial(rest)
    setWizardCodigo(u.codigo)
    setWizardOpen(true)
  }
  const handleWizardSave = (data: Omit<Unidade, 'id' | 'mantenedorId'>) => {
    const year = new Date().getFullYear()
    if (wizardEditingId) {
      setMantenedores(prev => prev.map(m =>
        m.id === wizardMantenedorId
          ? { ...m, unidades: m.unidades.map(u => u.id === wizardEditingId ? { ...u, ...data } : u) }
          : m
      ))
    } else {
      const codigo = `UNI-${year}-${Math.random().toString(36).slice(2,6).toUpperCase()}`
      setMantenedores(prev => prev.map(m =>
        m.id === wizardMantenedorId
          ? { ...m, unidades: [...m.unidades, { ...data, codigo, id: newId('U'), mantenedorId: wizardMantenedorId! }] }
          : m
      ))
    }
    setWizardOpen(false)
  }

  /* ── Delete ── */
  const executeDelete = () => {
    if (!confirmId) return
    if (confirmId.type === 'mantenedor') {
      setMantenedores(prev => prev.filter(m => m.id !== confirmId.mId))
    } else {
      setMantenedores(prev => prev.map(m =>
        m.id === confirmId.mId ? { ...m, unidades: m.unidades.filter(u => u.id !== confirmId.uId) } : m
      ))
    }
    setConfirmId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 26 }}>🏫 Multi-Unidades</h1>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, marginTop: 4 }}>Gestão de Mantenedores e Unidades Educacionais</p>
        </div>
        <button className="btn btn-primary" onClick={openAddMantenedor}><Plus size={15} /> Novo Mantenedor</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { icon: '🏢', label: 'Mantenedores', value: mantenedores.length, color: '#8b5cf6' },
          { icon: '🏫', label: 'Unidades', value: totalUnidades, color: '#3b82f6' },
          { icon: '🎓', label: 'Total de Alunos', value: totalAlunos.toLocaleString('pt-BR'), color: '#10b981' },
          { icon: '📋', label: 'CNPJs Cadastrados', value: mantenedores.length + totalUnidades, color: '#f59e0b' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${k.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{k.value}</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Mantenedores list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mantenedores.map(m => (
          <div key={m.id} className="card" style={{ overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))' }}>
            {/* Mantenedor Header */}
            <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', borderBottom: expanded.has(m.id) ? '1px solid hsl(var(--border-subtle))' : 'none' }}
              onClick={() => toggleExpanded(m.id)}>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: m.logo ? 'transparent' : 'var(--gradient-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))' }}>
                {m.logo ? <img src={m.logo} alt={m.nome} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} /> : <Building2 size={22} color="#fff" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>{m.nome}</span>
                </div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                  {m.responsavel} · {m.cargo || '—'} · {m.unidades.length} unidade(s)
                  {m.cidade && ` · ${m.cidade}/${m.estado}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm btn-icon" title="Editar" onClick={() => openEditMantenedor(m)}><Edit2 size={14} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" title="Excluir" onClick={() => setConfirmId({ type: 'mantenedor', mId: m.id })} style={{ color: '#f87171' }}><Trash2 size={14} /></button>
              </div>
              {expanded.has(m.id) ? <ChevronDown size={18} color="hsl(var(--text-muted))" /> : <ChevronRight size={18} color="hsl(var(--text-muted))" />}
            </div>

            {/* Expanded */}
            {expanded.has(m.id) && (
              <div>
                {/* Contact strip */}
                <div style={{ padding: '10px 20px', background: 'hsl(var(--bg-elevated))', display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                  {m.endereco && <span><MapPin size={11} style={{ marginRight: 3 }} />{m.endereco}, {m.cidade}/{m.estado}</span>}
                  {m.telefone && <span><Phone size={11} style={{ marginRight: 3 }} />{m.telefone}</span>}
                  {m.email && <span><Mail size={11} style={{ marginRight: 3 }} />{m.email}</span>}
                  {m.website && <span><Globe size={11} style={{ marginRight: 3 }} />{m.website}</span>}
                </div>

                {/* Unidades */}
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={14} /> Unidades
                      <span style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{m.unidades.length}</span>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => openAddUnidade(m.id)}>
                      <Plus size={13} /> Adicionar Unidade
                    </button>
                  </div>

                  {m.unidades.length === 0 ? (
                    <div style={{ padding: '28px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13, background: 'hsl(var(--bg-elevated))', borderRadius: 12 }}>
                      Nenhuma unidade cadastrada.{' '}
                      <button onClick={() => openAddUnidade(m.id)} style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Adicionar agora →</button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                      {m.unidades.map(u => (
                        <div key={u.id} style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 14, padding: '18px', border: '1px solid rgba(16,185,129,0.15)', transition: 'box-shadow 0.2s' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{u.nomeFantasia || u.razaoSocial}</div>
                          {u.razaoSocial && u.nomeFantasia && (
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>{u.razaoSocial}</div>
                          )}
                          {u.codigo && (
                            <div style={{ marginTop: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', background: 'rgba(99,102,241,0.12)', color: '#818cf8', borderRadius: 20, letterSpacing: '0.08em', fontFamily: 'monospace' }}>
                                🔖 {u.codigo}
                              </span>
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                                {u.codigoMec ? `MEC: ${u.codigoMec}` : ''}{u.idCenso ? ` · INEP: ${u.idCenso}` : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEditUnidade(m.id, u)}><Edit2 size={12} /></button>
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setConfirmId({ type: 'unidade', mId: m.id, uId: u.id })} style={{ color: '#f87171' }}><Trash2 size={12} /></button>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'hsl(var(--text-secondary))' }}><Users size={11} /> Alunos: <strong>{u.alunosAtivos}</strong></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'hsl(var(--text-secondary))' }}><BookOpen size={11} /> Capacidade: <strong>{u.capacidade}</strong></div>
                          </div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 8 }}>
                            <MapPin size={10} style={{ marginRight: 3 }} />{[u.endereco, u.numero, u.cidade].filter(Boolean).join(', ')}
                          </div>
                          {u.diretor?.nome && (
                            <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 4 }}>
                              👔 Dir.: {u.diretor.nome}{u.secretario?.nome ? `  ·  ✍️ Sec.: ${u.secretario.nome}` : ''}
                            </div>
                          )}
                          {u.cabecalhoDocumentos && (
                            <div style={{ marginTop: 6, padding: '4px 8px', background: 'rgba(99,102,241,0.08)', borderRadius: 6, fontSize: 10, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle size={9} /> Cabeçalho configurado
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {mantenedores.length === 0 && (
          <div style={{ textAlign: 'center', padding: '56px', color: 'hsl(var(--text-muted))', fontSize: 14 }}>
            <Building2 size={48} style={{ margin: '0 auto 14px', opacity: 0.3 }} />
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Nenhum mantenedor cadastrado</p>
            <p style={{ marginBottom: 20 }}>Cadastre a rede ou mantenedora principal para começar</p>
            <button className="btn btn-primary" onClick={openAddMantenedor}><Plus size={14} /> Adicionar primeiro mantenedor</button>
          </div>
        )}
      </div>

      {/* ── Mantenedor Modal ── */}
      {(modal === 'addMantenedor' || modal === 'editMantenedor') && (
        <Modal title={modal === 'addMantenedor' ? '🏢 Novo Mantenedor' : '✏️ Editar Mantenedor'} onClose={() => setModal(null)}>
          <MantenedorForm data={formMantenedor} onChange={setFormMantenedor} logoRef={logoRef} onLogoUpload={handleLogoUpload} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveMantenedor}>
              {saved ? <><CheckCircle size={14} style={{ color: '#34d399' }} />Salvo!</> : <><Save size={14} />Salvar Mantenedor</>}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Unidade Wizard ── */}
      {wizardOpen && (
        <UnidadeWizard
          initial={wizardInitial}
          codigoExistente={wizardCodigo}
          onSave={handleWizardSave}
          onClose={() => setWizardOpen(false)}
          mode={wizardEditingId ? 'edit' : 'add'}
        />
      )}

      {/* ── Confirm Delete ── */}
      {confirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '32px', maxWidth: 400, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Confirmar exclusão</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 22 }}>
              {confirmId.type === 'mantenedor' ? 'O mantenedor e todas as suas unidades serão excluídos permanentemente.' : 'A unidade e todos os seus dados (responsáveis, cabeçalhos) serão excluídos.'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmId(null)}>Cancelar</button>
              <button style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }} onClick={executeDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
