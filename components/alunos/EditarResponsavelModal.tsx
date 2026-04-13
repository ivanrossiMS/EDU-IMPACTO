'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  X, Save, Loader2, AlertCircle, Trash2, User, Phone, Mail,
  MapPin, Shield, Heart, Link2, Unlink, BookOpen, Fingerprint,
} from 'lucide-react'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Vinculo {
  aluno_id: string
  aluno_nome: string
  aluno_turma: string
  aluno_serie: string
  tipo: string
  resp_financeiro: boolean
  resp_pedagogico: boolean
}

interface Props {
  responsavelId: string | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

// ─── Constants ──────────────────────────────────────────────────────────────
const SEXO_OPTS   = [{ v: 'M', l: 'Masculino' }, { v: 'F', l: 'Feminino' }, { v: 'Outro', l: 'Outro' }]
const ESTADO_CIVIL = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável']
const TIPO_OPTS   = ['mae', 'pai', 'outro']
const TIPO_LABEL: Record<string, string> = { mae: 'Mãe', pai: 'Pai', outro: 'Outro' }

function endOf(e: any) {
  if (!e) return {}
  if (typeof e === 'string') { try { return JSON.parse(e) } catch { return {} } }
  return e
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{
        fontSize: 10, fontWeight: 700, color: '#8b9ab5',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 13px', fontSize: 14,
  background: '#f8faff', border: '1.5px solid #e8edf7',
  borderRadius: 10, color: '#1a2035', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxSizing: 'border-box',
}

function Inp({ value, onChange, placeholder, type = 'text', maxLength }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string; type?: string; maxLength?: number
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      maxLength={maxLength}
      style={{
        ...inputStyle,
        borderColor: focused ? '#6366f1' : '#e8edf7',
        boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
        background: focused ? '#fff' : '#f8faff',
      }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    />
  )
}

function Sel({ value, onChange, children }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  return (
    <select
      value={value} onChange={onChange}
      style={{
        ...inputStyle,
        borderColor: focused ? '#6366f1' : '#e8edf7',
        boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
        background: focused ? '#fff' : '#f8faff',
        cursor: 'pointer',
      }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    >{children}</select>
  )
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 0 10px', borderBottom: '1.5px solid #f0f2f8', marginBottom: 4,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8,
        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        flexShrink: 0,
      }}>{icon}</div>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </span>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color, background: bg, border: `1px solid ${border}`,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function EditarResponsavelModal({ responsavelId, isOpen, onClose, onSaved, onDeleted }: Props) {
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [tab, setTab]           = useState<'dados' | 'vinculos'>('dados')

  const [form, setForm] = useState({
    nome: '', cpf: '', rg: '', org_emissor: '', sexo: '', data_nasc: '',
    email: '', telefone: '', profissao: '',
    tipo: '', estado_civil: '', naturalidade: '', uf: '', nacionalidade: 'Brasileira',
    obs: '', rfid: '', codigo: '',
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  })

  const [vinculos, setVinculos] = useState<Vinculo[]>([])

  const upd = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [f]: e.target.value }))

  const carregar = useCallback(async () => {
    if (!responsavelId) return
    setLoading(true); setError(null); setConfirm(false); setTab('dados')
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/responsaveis?id=${responsavelId}`),
        fetch(`/api/responsaveis?aluno_id_of=${responsavelId}`),
      ])
      const data  = await r1.json()
      const vData = await r2.json()
      const end   = endOf(data.endereco)

      // Garante string vazia em vez de null/undefined
      const s = (v: any): string => (v == null ? '' : String(v))

      // Garante formato inicial em DD/MM/YYYY para carregar no text input
      const toDDMMYYYY = (v: any): string => {
        if (!v) return ''
        const str = String(v)
        if (str.includes('/')) return str // ja esta
        // yyyy-mm-dd -> dd/mm/yyyy
        const m = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
        if (m) return `${m[3]}/${m[2]}/${m[1]}`
        return str
      }

      setForm({
        nome: s(data.nome), cpf: s(data.cpf), rg: s(data.rg),
        org_emissor: s(data.org_emissor), sexo: s(data.sexo),
        data_nasc: toDDMMYYYY(data.data_nasc), email: s(data.email),
        telefone: s(data.telefone ?? data.celular),
        profissao: s(data.profissao), tipo: s(data.tipo),
        estado_civil: s(data.estado_civil), naturalidade: s(data.naturalidade),
        uf: s(data.uf), nacionalidade: s(data.nacionalidade || 'Brasileira'),
        obs: s(data.obs), rfid: s(data.rfid), codigo: s(data.codigo),
        cep: s(end.cep), logradouro: s(end.logradouro), numero: s(end.numero),
        complemento: s(end.complemento), bairro: s(end.bairro),
        cidade: s(end.cidade), estado: s(end.estado),
      })

      const lista = Array.isArray(vData) ? vData : (vData.data ?? [])
      setVinculos(lista.map((v: any) => ({
        aluno_id: v.aluno_id,
        aluno_nome: v.aluno?.nome || '',
        aluno_turma: v.aluno?.turma || '',
        aluno_serie: v.aluno?.serie || '',
        tipo: v.tipo || '',
        resp_financeiro: !!v.resp_financeiro,
        resp_pedagogico: !!v.resp_pedagogico,
      })))
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [responsavelId])

  useEffect(() => { if (isOpen && responsavelId) carregar() }, [isOpen, responsavelId, carregar])

  const handleSave = async () => {
    if (!responsavelId) return
    if (!form.nome.trim() || form.nome.trim().length < 2) { setError('Nome é obrigatório.'); return }
    setSaving(true); setError(null)
    try {
      const r = await fetch('/api/responsaveis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: responsavelId,
          nome: form.nome.trim(),
          cpf: form.cpf.replace(/\D/g, '') || null,
          rg: form.rg || null, org_emissor: form.org_emissor || null,
          sexo: form.sexo || null, data_nasc: form.data_nasc || null,
          email: form.email || null, telefone: form.telefone || null,
          profissao: form.profissao || null, tipo: form.tipo || null,
          estado_civil: form.estado_civil || null,
          naturalidade: form.naturalidade || null, uf: form.uf || null,
          nacionalidade: form.nacionalidade || 'Brasileira',
          obs: form.obs || null, rfid: form.rfid || null, codigo: form.codigo || null,
          endereco: {
            cep: form.cep, logradouro: form.logradouro, numero: form.numero,
            complemento: form.complemento, bairro: form.bairro,
            cidade: form.cidade, estado: form.estado,
          },
        }),
      })
      if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'Erro ao salvar') }
      onSaved(); onClose()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!responsavelId) return
    setDeleting(true); setError(null)
    try {
      const r = await fetch(`/api/responsaveis?id=${responsavelId}`, { method: 'DELETE' })
      if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'Erro ao excluir') }
      onDeleted(); onClose()
    } catch (e: any) { setError(e.message); setConfirm(false) }
    finally { setDeleting(false) }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(15,20,40,0.45)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      <div style={{
        background: 'linear-gradient(160deg, #ffffff 0%, #f7f9ff 100%)',
        borderRadius: 22, width: 'min(720px,100%)', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(60,72,120,0.22), 0 8px 24px rgba(60,72,120,0.1), 0 0 0 1px rgba(255,255,255,0.9)',
        border: '1px solid rgba(220,228,255,0.8)',
        overflow: 'hidden',
      }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: '22px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          borderBottom: '1px solid rgba(99,102,241,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14,
              background: 'rgba(99,102,241,0.18)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#a5b4fc', border: '1.5px solid rgba(99,102,241,0.3)',
            }}>
              <User size={20} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2 }}>
                {loading ? 'Carregando...' : (form.nome || '—')}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Editar responsável · {vinculos.length} vínculo(s)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!confirm ? (
              <button
                onClick={() => setConfirm(true)} title="Excluir"
                style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 10, color: '#f87171', padding: '8px 10px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.25)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.4)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.2)' }}
              >
                <Trash2 size={16} />
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '6px 10px' }}>
                <span style={{ fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>Excluir?</span>
                <button
                  onClick={handleDelete} disabled={deleting}
                  style={{ background: '#ef4444', border: 'none', borderRadius: 7, color: '#fff', padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {deleting ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Sim'}
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 7, color: '#94a3b8', padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
                >
                  Não
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: '#94a3b8', padding: '8px 10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' }}
            ><X size={18} /></button>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', padding: '0 28px',
          borderBottom: '1.5px solid #eef0f8',
          background: '#fff', flexShrink: 0,
        }}>
          {(['dados', 'vinculos'] as const).map(key => {
            const label = key === 'dados' ? 'Dados Pessoais' : 'Vínculos com Alunos'
            const active = tab === key
            return (
              <button key={key} onClick={() => setTab(key)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '14px 18px', fontSize: 13, fontWeight: 700,
                color: active ? '#4f46e5' : '#a0aec0',
                borderBottom: active ? '2.5px solid #6366f1' : '2.5px solid transparent',
                marginBottom: -1.5, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                {label}
                {key === 'vinculos' && vinculos.length > 0 && (
                  <span style={{
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 800,
                  }}>{vinculos.length}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12, color: '#94a3b8' }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontWeight: 600 }}>Carregando dados...</span>
            </div>
          )}

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff1f2', border: '1.5px solid #fecdd3',
              borderRadius: 12, padding: '12px 16px', color: '#be123c', fontSize: 13, fontWeight: 600,
            }}>
              <AlertCircle size={16} />{error}
            </div>
          )}

          {/* ── DADOS PESSOAIS ── */}
          {!loading && tab === 'dados' && (
            <>
              {/* Identificação */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SectionHeader icon={<Fingerprint size={14} />} label="Identificação" />

                {/* Badge ID */}
                {(form.codigo || responsavelId) && (
                  <div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.08))',
                      border: '1.5px solid rgba(99,102,241,0.2)',
                      color: '#5b21b6', borderRadius: 20, padding: '5px 14px',
                      fontSize: 12, fontWeight: 700,
                    }}>
                      <Shield size={11} />
                      {form.codigo ? `Código: ${form.codigo}` : `ID: ${String(responsavelId).slice(0, 8)}...`}
                    </span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <Field label="Nome completo *">
                    <Inp value={form.nome} onChange={upd('nome')} placeholder="Nome completo" />
                  </Field>
                  <Field label="CPF">
                    <Inp value={form.cpf} onChange={upd('cpf')} placeholder="000.000.000-00" />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Field label="RG">
                    <Inp value={form.rg} onChange={upd('rg')} placeholder="RG" />
                  </Field>
                  <Field label="Órgão Emissor">
                    <Inp value={form.org_emissor} onChange={upd('org_emissor')} placeholder="SSP/SP" />
                  </Field>
                  <Field label="RFID / Cartão">
                    <Inp value={form.rfid} onChange={upd('rfid')} placeholder="Tag RFID" />
                  </Field>
                </div>
              </div>

              {/* Dados Pessoais */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SectionHeader icon={<Heart size={14} />} label="Dados Pessoais" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Field label="Sexo">
                    <Sel value={form.sexo} onChange={upd('sexo')}>
                      <option value="">Selecionar</option>
                      {SEXO_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </Sel>
                  </Field>
                  <Field label="Data de Nascimento">
                    <Inp 
                      type="text" maxLength={10} placeholder="DD/MM/YYYY" 
                      value={form.data_nasc || ''} 
                      onChange={e => {
                        let v = e.target.value.replace(/\D/g, '')
                        if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2)
                        if (v.length > 5) v = v.slice(0, 5) + '/' + v.slice(5, 9)
                        upd('data_nasc')({ target: { value: v } } as any)
                      }} 
                    />
                  </Field>
                  <Field label="Estado Civil">
                    <Sel value={form.estado_civil} onChange={upd('estado_civil')}>
                      <option value="">Selecionar</option>
                      {ESTADO_CIVIL.map(s => <option key={s}>{s}</option>)}
                    </Sel>
                  </Field>
                  <Field label="Tipo">
                    <Sel value={form.tipo} onChange={upd('tipo')}>
                      <option value="">Selecionar</option>
                      {TIPO_OPTS.map(t => <option key={t}>{t}</option>)}
                    </Sel>
                  </Field>
                  <Field label="Profissão">
                    <Inp value={form.profissao} onChange={upd('profissao')} placeholder="Profissão" />
                  </Field>
                  <Field label="Naturalidade">
                    <Inp value={form.naturalidade} onChange={upd('naturalidade')} placeholder="Cidade" />
                  </Field>
                  <Field label="UF">
                    <Inp value={form.uf} onChange={upd('uf')} placeholder="SP" maxLength={2} />
                  </Field>
                  <Field label="Nacionalidade">
                    <Inp value={form.nacionalidade} onChange={upd('nacionalidade')} placeholder="Brasileira" />
                  </Field>
                </div>
              </div>

              {/* Contato */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SectionHeader icon={<Phone size={14} />} label="Contato" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="E-mail">
                    <Inp type="email" value={form.email} onChange={upd('email')} placeholder="email@exemplo.com" />
                  </Field>
                  <Field label="Celular / WhatsApp">
                    <Inp value={form.telefone} onChange={upd('telefone')} placeholder="(00) 00000-0000" />
                  </Field>
                </div>
              </div>

              {/* Endereço */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SectionHeader icon={<MapPin size={14} />} label="Endereço" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <Field label="CEP">
                    <Inp value={form.cep} onChange={upd('cep')} placeholder="00000-000" />
                  </Field>
                  <Field label="Logradouro">
                    <Inp value={form.logradouro} onChange={upd('logradouro')} placeholder="Rua, Av..." />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                  <Field label="Número">
                    <Inp value={form.numero} onChange={upd('numero')} placeholder="123" />
                  </Field>
                  <Field label="Complemento">
                    <Inp value={form.complemento} onChange={upd('complemento')} placeholder="Apto..." />
                  </Field>
                  <Field label="Bairro">
                    <Inp value={form.bairro} onChange={upd('bairro')} placeholder="Bairro" />
                  </Field>
                  <Field label="Cidade">
                    <Inp value={form.cidade} onChange={upd('cidade')} placeholder="Cidade" />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 12 }}>
                  <Field label="Estado (UF)">
                    <Inp value={form.estado} onChange={upd('estado')} placeholder="UF" maxLength={2} />
                  </Field>
                </div>
              </div>

              {/* Observações */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SectionHeader icon={<BookOpen size={14} />} label="Observações" />
                <textarea
                  value={form.obs} onChange={upd('obs')}
                  placeholder="Observações relevantes..."
                  rows={3}
                  style={{
                    ...inputStyle, resize: 'none', lineHeight: 1.6,
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; e.currentTarget.style.background = '#fff' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e8edf7'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#f8faff' }}
                />
              </div>
            </>
          )}

          {/* ── VÍNCULOS ── */}
          {!loading && tab === 'vinculos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionHeader icon={<Link2 size={14} />} label="Alunos vinculados" />

              {vinculos.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '48px 20px',
                  background: 'linear-gradient(135deg,#f8faff,#f3f4f8)',
                  borderRadius: 16, border: '1.5px dashed #d1d5f0',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🔗</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                    Nenhum aluno vinculado
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
                    Os vínculos são criados no cadastro de matrícula do aluno.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {vinculos.map(v => (
                    <div key={v.aluno_id} style={{
                      background: '#fff',
                      border: '1.5px solid #eef0f8',
                      borderRadius: 14, padding: '14px 18px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      boxShadow: '0 2px 8px rgba(60,72,120,0.06)',
                      transition: 'box-shadow 0.15s',
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 14, fontWeight: 800,
                        boxShadow: '0 4px 10px rgba(99,102,241,0.3)',
                      }}>
                        {getInitials(v.aluno_nome)}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2035', marginBottom: 6 }}>
                          {v.aluno_nome}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                          {[v.aluno_turma, v.aluno_serie].filter(Boolean).join(' · ')}
                        </div>
                        {/* Badges — SEM parentesco */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {v.tipo && (
                            <Badge
                              label={TIPO_LABEL[v.tipo] ?? v.tipo}
                              color="#4f46e5" bg="#eef2ff" border="#c7d2fe"
                            />
                          )}
                          {v.resp_financeiro && (
                            <Badge label="💰 Resp. Financeiro" color="#92400e" bg="#fffbeb" border="#fde68a" />
                          )}
                          {v.resp_pedagogico && (
                            <Badge label="📚 Resp. Pedagógico" color="#1e40af" bg="#eff6ff" border="#bfdbfe" />
                          )}
                          {!v.tipo && !v.resp_financeiro && !v.resp_pedagogico && (
                            <Badge label="Sem papel definido" color="#6b7280" bg="#f9fafb" border="#e5e7eb" />
                          )}
                        </div>
                      </div>

                      {/* Link */}
                      <Link
                        href={`/academico/alunos/ficha?id=${v.aluno_id}`}
                        onClick={onClose}
                        style={{
                          fontSize: 12, fontWeight: 600,
                          color: '#4f46e5', textDecoration: 'none',
                          background: '#eef2ff', border: '1.5px solid #c7d2fe',
                          padding: '6px 14px', borderRadius: 9, flexShrink: 0,
                          transition: 'all 0.15s',
                        }}
                      >
                        Ficha 360°
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '18px 28px',
          borderTop: '1.5px solid #eef0f8',
          background: 'linear-gradient(to right,#fafbff,#f7f9ff)',
          flexShrink: 0,
        }}>
          <button onClick={onClose} disabled={saving} style={{
            background: '#f1f5f9', border: '1.5px solid #e2e8f0',
            color: '#475569', padding: '10px 22px', borderRadius: 11, fontSize: 14,
            fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || loading} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: saving || loading ? '#94a3b8' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 11,
            fontSize: 14, fontWeight: 700, cursor: saving || loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.18s',
            boxShadow: saving || loading ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
          }}>
            {saving
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
              : <><Save size={15} /> Salvar Alterações</>}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
