'use client'

import { useState, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, Save, Upload, CheckCircle, User, Building2, FileText } from 'lucide-react'
import { Unidade, Responsavel, newId } from '@/lib/dataContext'
import { CepAddressFields } from '@/components/ui/CepInput'
import { compressImage } from '@/lib/imageUtils'

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const BLANK_RESPONSAVEL: Responsavel = { nome: '', cpf: '', autorizacao: '', assinatura: null }

export const BLANK_UNIDADE: Omit<Unidade, 'id' | 'mantenedorId'> = {
  codigo: '',
  razaoSocial: '', nomeFantasia: '', cnpj: '', inep: '',
  codigoMec: '', idCenso: '',
  endereco: '', numero: '', complemento: '', bairro: '',
  cidade: '', estado: 'SP', cep: '',
  telefone: '', email: '',
  alunosAtivos: 0, capacidade: 0,
  diretor: { ...BLANK_RESPONSAVEL },
  secretario: { ...BLANK_RESPONSAVEL },
  cabecalhoDocumentos: '',
  cabecalhoLogo: '',
}

const STEPS = [
  { icon: Building2, label: 'Dados da Unidade', desc: 'Razão social, endereço, MEC' },
  { icon: User,      label: 'Responsáveis', desc: 'Diretor e Secretário' },
  { icon: FileText,  label: 'Cabeçalhos', desc: 'Impressão de documentos' },
]

interface Props {
  initial?: Omit<Unidade, 'id' | 'mantenedorId'>
  codigoExistente?: string // shown readonly when editing
  onSave: (data: Omit<Unidade, 'id' | 'mantenedorId'>) => void
  onClose: () => void
  mode?: 'add' | 'edit'
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label} {required && <span style={{ color: '#f87171' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function SignatureUpload({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const result = ev.target?.result as string
      const compressed = await compressImage(result, 600, 300)
      onChange(compressed)
    }
    reader.readAsDataURL(file)
  }
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <div
        onClick={() => ref.current?.click()}
        style={{ border: `2px dashed ${value ? '#10b981' : 'hsl(var(--border-default))'}`, borderRadius: 10, padding: '14px', textAlign: 'center', cursor: 'pointer', background: value ? 'rgba(16,185,129,0.05)' : 'hsl(var(--bg-elevated))', transition: 'all 0.2s', minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
      >
        {value ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={value} alt="imagem carregada" style={{ maxHeight: 60, maxWidth: 160, objectFit: 'contain', borderRadius: 4, background: '#fff', padding: 4 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>✓ Imagem carregada</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Clique para substituir</div>
            </div>
          </div>
        ) : (
          <div>
            <Upload size={20} color="hsl(var(--text-muted))" style={{ margin: '0 auto 4px' }} />
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Clique para carregar imagem</div>
            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>PNG, JPG ou SVG</div>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{ fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}
        >✕ Remover imagem</button>
      )}
    </div>
  )
}

function ResponsavelCard({ title, emoji, data, onChange }: {
  title: string; emoji: string
  data: Responsavel
  onChange: (d: Responsavel) => void
}) {
  const f = (key: keyof Responsavel) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [key]: e.target.value })
  return (
    <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 14, padding: '20px', border: '1px solid hsl(var(--border-subtle))' }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{emoji}</span> {title}
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nome completo" required>
            <input className="form-input" value={data.nome} onChange={f('nome')} placeholder={`Nome do(a) ${title}`} />
          </Field>
          <Field label="CPF">
            <input className="form-input" value={data.cpf} onChange={f('cpf')} placeholder="000.000.000-00" />
          </Field>
        </div>
        <Field label="Declaração de autorização / Portaria">
          <textarea className="form-input" rows={2} value={data.autorizacao} onChange={f('autorizacao')}
            placeholder={`Ex: Portaria nº 001/2026, designado(a) como ${title} da unidade...`}
            style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>
        <SignatureUpload
          value={data.assinatura}
          onChange={v => onChange({ ...data, assinatura: v })}
          label="Imagem da assinatura"
        />
      </div>
    </div>
  )
}

export default function UnidadeWizard({ initial, codigoExistente, onSave, onClose, mode = 'add' }: Props) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<Omit<Unidade, 'id' | 'mantenedorId'>>(initial ?? { ...BLANK_UNIDADE })
  const [errors, setErrors] = useState<string[]>([])

  const set = (key: keyof typeof data, value: unknown) => setData(prev => ({ ...prev, [key]: value }))
  const f = (key: keyof typeof data) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    set(key, e.target.value)

  const validateStep = () => {
    if (step === 0) {
      const errs: string[] = []
      if (!data.razaoSocial.trim()) errs.push('Razão social é obrigatório')
      if (!data.nomeFantasia.trim()) errs.push('Nome fantasia é obrigatório')
      if (!data.endereco.trim()) errs.push('Endereço é obrigatório')
      if (!data.cidade.trim()) errs.push('Cidade é obrigatória')
      setErrors(errs)
      return errs.length === 0
    }
    if (step === 1) {
      const errs: string[] = []
      if (!data.diretor.nome.trim()) errs.push('Nome do diretor é obrigatório')
      setErrors(errs)
      return errs.length === 0
    }
    setErrors([])
    return true
  }

  const next = () => { if (validateStep()) { setStep(s => s + 1); setErrors([]) } }
  const back = () => { setStep(s => s - 1); setErrors([]) }
  const handleSave = () => { if (validateStep()) onSave(data) }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24, backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '92vh', overflow: 'hidden', border: '1px solid hsl(var(--border-default))', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{mode === 'add' ? '🏫 Nova Unidade' : '✏️ Editar Unidade'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{data.nomeFantasia || 'Complete os dados passo a passo'}</span>
              {codigoExistente && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', background: 'rgba(99,102,241,0.12)', color: '#818cf8', borderRadius: 20, letterSpacing: '0.08em' }}>{codigoExistente}</span>
              )}
              {!codigoExistente && mode === 'add' && (
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>código gerado ao salvar</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>

        {/* Step tabs */}
        <div style={{ padding: '0 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))' }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done = i < step
              const active = i === step
              return (
                <div key={i} onClick={() => { if(i < step) { setStep(i); setErrors([]) } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', cursor: i < step ? 'pointer' : 'default', borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent', flex: 1, opacity: i > step ? 0.4 : 1, transition: 'all 0.2s' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? '#10b981' : active ? '#3b82f6' : 'hsl(var(--bg-overlay))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                    {done ? <CheckCircle size={14} color="#fff" /> : <Icon size={13} color={active ? '#fff' : 'hsl(var(--text-muted))'} />}
                  </div>
                  <div style={{ display: 'none', flex: 1 }} className="step-label">
                    <div style={{ fontSize: 11, fontWeight: 700, color: active ? '#60a5fa' : done ? '#34d399' : 'hsl(var(--text-muted))' }}>Passo {i+1}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: active ? '#60a5fa' : done ? '#34d399' : 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Passo {i+1}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{s.label}</div>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Progress bar */}
          <div style={{ height: 3, background: 'hsl(var(--bg-overlay))', borderRadius: 99, marginBottom: -1 }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius: 99, width: `${progress}%`, transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {errors.length > 0 && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, fontSize: 12, color: '#fca5a5' }}>
              {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
            </div>
          )}

          {/* ── PASSO 1: Dados ── */}
          {step === 0 && (
            <div style={{ display: 'grid', gap: 16 }}>
              {codigoExistente && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10 }}>
                  <span style={{ fontSize: 18 }}>🔖</span>
                  <div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Código da Unidade</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#818cf8', letterSpacing: '0.1em', fontFamily: 'monospace' }}>{codigoExistente}</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Razão Social" required>
                  <input className="form-input" value={data.razaoSocial} onChange={f('razaoSocial')} placeholder="ESCOLA... LTDA" />
                </Field>
                <Field label="Nome Fantasia" required>
                  <input className="form-input" value={data.nomeFantasia} onChange={f('nomeFantasia')} placeholder="Unidade..." />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="CNPJ">
                  <input className="form-input" value={data.cnpj} onChange={f('cnpj')} placeholder="00.000.000/0001-00" />
                </Field>
                <Field label="Código MEC">
                  <input className="form-input" value={data.codigoMec} onChange={f('codigoMec')} placeholder="Ex: 35012345" />
                </Field>
                <Field label="ID Censo (INEP)">
                  <input className="form-input" value={data.idCenso || data.inep} onChange={e => { set('idCenso', e.target.value); set('inep', e.target.value) }} placeholder="Ex: 35123456" />
                </Field>
              </div>

              <div style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📍 Endereço Completo</div>

              <CepAddressFields
                cep={data.cep}
                logradouro={data.endereco}
                numero={data.numero}
                complemento={data.complemento}
                bairro={data.bairro}
                cidade={data.cidade}
                estado={data.estado}
                onChange={(field, value) => {
                  const map: Record<string, keyof typeof data> = {
                    cep: 'cep', logradouro: 'endereco', numero: 'numero',
                    complemento: 'complemento', bairro: 'bairro',
                    cidade: 'cidade', estado: 'estado',
                  }
                  if (map[field]) set(map[field] as keyof typeof data, value)
                }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Telefone">
                  <input className="form-input" value={data.telefone} onChange={f('telefone')} placeholder="(11) 0000-0000" />
                </Field>
                <Field label="E-mail da unidade">
                  <input className="form-input" type="email" value={data.email} onChange={f('email')} placeholder="unidade@escola.com.br" />
                </Field>
              </div>
            </div>
          )}

          {/* ── PASSO 2: Responsáveis ── */}
          {step === 1 && (
            <div style={{ display: 'grid', gap: 20 }}>
              <ResponsavelCard title="Diretor(a)" emoji="👔" data={data.diretor} onChange={v => set('diretor', v)} />
              <ResponsavelCard title="Secretário(a)" emoji="✍️" data={data.secretario} onChange={v => set('secretario', v)} />
            </div>
          )}

          {/* ── PASSO 3: Cabeçalhos ── */}
          {step === 2 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ padding: '14px 16px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                💡 O cabeçalho será inserido automaticamente no topo de documentos gerados pela secretaria, como históricos, declarações e atas.
              </div>
              <SignatureUpload
                value={data.cabecalhoLogo || null}
                onChange={v => set('cabecalhoLogo', v || '')}
                label="Logotipo da Unidade (Cabeçalho)"
              />
              <Field label="Cabeçalho para impressão de documentos">
                <textarea
                  className="form-input"
                  rows={8}
                  style={{ resize: 'vertical', fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.8 }}
                  value={data.cabecalhoDocumentos}
                  onChange={f('cabecalhoDocumentos')}
                  placeholder={`Estado de São Paulo\nMunicípio de São Paulo - Secretaria Municipal de Educação\n\n${data.razaoSocial || 'NOME DA INSTITUIÇÃO'}\n${data.nomeFantasia || 'Nome Fantasia'}\nCNPJ: ${data.cnpj || '00.000.000/0001-00'}\n${data.endereco}${data.numero ? ', ' + data.numero : ''}, ${data.bairro} - ${data.cidade}/${data.estado}\nTel: ${data.telefone} | ${data.email}\nCódigo MEC: ${data.codigoMec || '—'} | INEP: ${data.idCenso || '—'}`}
                />
              </Field>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => set('cabecalhoDocumentos', `Estado de São Paulo\nMunicípio de ${data.cidade || 'São Paulo'} — Secretaria de Educação\n\n${data.razaoSocial}\n${data.nomeFantasia}\nCNPJ: ${data.cnpj}\n${data.endereco}${data.numero ? ', nº ' + data.numero : ''}${data.complemento ? ' - ' + data.complemento : ''}, ${data.bairro ? data.bairro + ', ' : ''}${data.cidade}/${data.estado} — CEP ${data.cep}\nTel: ${data.telefone} | E-mail: ${data.email}\nCódigo MEC: ${data.codigoMec} | INEP/Censo: ${data.idCenso}`)}
              >
                ✨ Gerar cabeçalho automático com os dados cadastrados
              </button>
              {/* Preview */}
              {data.cabecalhoDocumentos && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Pré-visualização</div>
                  <div style={{ padding: '20px 24px', background: '#fff', color: '#1a1a1a', borderRadius: 10, border: '1px solid #e5e7eb', fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.8, borderTop: '4px solid #1e3a8a', display: 'flex', alignItems: 'center', gap: 24 }}>
                    {data.cabecalhoLogo && (
                      <img src={data.cabecalhoLogo} alt="Logo" style={{ maxHeight: 80, maxWidth: 120, objectFit: 'contain' }} />
                    )}
                    <div style={{ whiteSpace: 'pre-wrap', flex: 1 }}>{data.cabecalhoDocumentos}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 10, justifyContent: 'space-between', background: 'hsl(var(--bg-elevated))' }}>
          <button className="btn btn-ghost" onClick={step === 0 ? onClose : back}>
            {step === 0 ? 'Cancelar' : <><ChevronLeft size={14} />Voltar</>}
          </button>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Passo {step + 1} de {STEPS.length}</span>
            {step < STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={next}>
                Próximo <ChevronRight size={14} />
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleSave} style={{ background: 'linear-gradient(135deg,#10b981,#3b82f6)' }}>
                <Save size={14} /> {mode === 'add' ? 'Criar Unidade' : 'Salvar Alterações'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
