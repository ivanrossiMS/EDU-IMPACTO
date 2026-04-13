'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X, User, Save, Loader2, AlertCircle, BookOpen,
  Wallet, MapPin, Search, Plus, Trash2, GraduationCap,
  CreditCard, AlertTriangle, ChevronDown
} from 'lucide-react'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'

interface Vinculo {
  aluno_id: string
  nome: string
  turma?: string
  parentesco?: string
  resp_pedagogico?: boolean
  resp_financeiro?: boolean
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (responsavel: any) => void
  onDeleted?: (id: string) => void
  responsavelInicial?: any | null
}

const PARENTESCO_OPTIONS = ['Mãe', 'Pai', 'Avó', 'Avô', 'Tio(a)', 'Irmão/Irmã', 'Padrasto/Madrasta', 'Responsável Legal', 'Outro']

// ─── Styles ────────────────────────────────────────────────────────────────────
const FIELD_LABEL: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '0.07em',
  textTransform: 'uppercase', color: '#64748b', marginBottom: 5,
}
const FIELD_INPUT: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1.5px solid #e2e8f0',
  borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 500,
  color: '#0f172a', outline: 'none', transition: 'border-color 0.18s',
  boxSizing: 'border-box',
}
const FIELD_SELECT: React.CSSProperties = {
  ...FIELD_INPUT, cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'calc(100% - 10px) center',
  paddingRight: 32,
}
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: '#94a3b8', borderBottom: '1.5px solid #f1f5f9', paddingBottom: 8,
  marginBottom: 14,
}

// Helper components
function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      <label style={FIELD_LABEL}>{label}</label>
      {children}
    </div>
  )
}

export function CadastroResponsavelModal({ isOpen, onClose, onSaved, onDeleted, responsavelInicial }: Props) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const [alunosDb] = useSupabaseArray<any>('alunos')
  const [buscaAluno, setBuscaAluno] = useState('')

  const [form, setForm] = useState({
    id: '', nome: '', cpf: '', rg: '', org_emissor: '',
    sexo: '', data_nasc: '', email: '', telefone: '', celular: '',
    profissao: '', naturalidade: '', uf: '', nacionalidade: 'Brasileira',
    estado_civil: '', rfid: '', codigo: '', obs: '',
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  })
  const [vinculos, setVinculos] = useState<Vinculo[]>([])

  // ─── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    setError(null); setConfirmDelete(false)
    if (responsavelInicial) {
      const end = responsavelInicial.endereco || responsavelInicial.dados?.endereco || {}
      setForm({
        id: responsavelInicial.id || '',
        nome: responsavelInicial.nome || '',
        cpf: responsavelInicial.cpf ? fmtCPF(responsavelInicial.cpf) : '',
        rg: responsavelInicial.rg || '',
        org_emissor: responsavelInicial.org_emissor || '',
        sexo: responsavelInicial.sexo || '',
        data_nasc: responsavelInicial.data_nasc || responsavelInicial.dataNasc || '',
        email: responsavelInicial.email || '',
        telefone: responsavelInicial.telefone || '',
        celular: responsavelInicial.celular || '',
        profissao: responsavelInicial.profissao || '',
        naturalidade: responsavelInicial.naturalidade || '',
        uf: responsavelInicial.uf || '',
        nacionalidade: responsavelInicial.nacionalidade || 'Brasileira',
        estado_civil: responsavelInicial.estado_civil || responsavelInicial.estadoCivil || '',
        rfid: responsavelInicial.rfid || '',
        codigo: responsavelInicial.codigo || '',
        obs: responsavelInicial.obs || responsavelInicial.dados?.obs || '',
        cep: end.cep || '', logradouro: end.logradouro || '', numero: end.numero || '',
        complemento: end.complemento || '', bairro: end.bairro || '', cidade: end.cidade || '', estado: end.estado || '',
      })
      setVinculos(responsavelInicial._vinculos?.map((v: any) => ({
        aluno_id: v.aluno_id, nome: v.aluno?.nome || '—', turma: v.aluno?.turma || '',
        foto: v.aluno?.foto || v.aluno?.dados?.foto || '',
        parentesco: v.parentesco || '', resp_pedagogico: !!v.resp_pedagogico, resp_financeiro: !!v.resp_financeiro,
      })) || [])
    } else {
      setForm({ id:'', nome:'', cpf:'', rg:'', org_emissor:'', sexo:'', data_nasc:'', email:'', telefone:'', celular:'', profissao:'', naturalidade:'', uf:'', nacionalidade:'Brasileira', estado_civil:'', rfid:'', codigo:'', obs:'', cep:'', logradouro:'', numero:'', complemento:'', bairro:'', cidade:'', estado:'' })
      setVinculos([])
    }
    setBuscaAluno('')
  }, [isOpen, responsavelInicial])

  // ─── Masks ─────────────────────────────────────────────────────────────────
  function fmtCPF(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
  }
  function fmtTel(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  }
  function fmtCEP(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 8)
    return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}`
  }

  const upd = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }))

  const inputStyle = (name: string): React.CSSProperties => ({
    ...FIELD_INPUT,
    borderColor: focusedField === name ? '#6366f1' : '#e2e8f0',
    boxShadow: focusedField === name ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
  })
  const selectStyle = (name: string): React.CSSProperties => ({
    ...FIELD_SELECT,
    borderColor: focusedField === name ? '#6366f1' : '#e2e8f0',
    boxShadow: focusedField === name ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
  })
  const focus = (name: string) => ({ onFocus: () => setFocusedField(name), onBlur: () => setFocusedField(null) })

  // CEP lookup
  const buscarCEP = async (cep: string) => {
    const d = cep.replace(/\D/g, '')
    if (d.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
      const j = await r.json()
      if (!j.erro) setForm(p => ({ ...p, logradouro: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', estado: j.uf || '' }))
    } catch {}
  }

  // Aluno search
  const resultAlunos = useMemo(() => {
    if (buscaAluno.length < 2) return []
    const q = buscaAluno.toLowerCase()
    return alunosDb.filter(a => a.nome?.toLowerCase().includes(q) || (a.codigo || '').toLowerCase().includes(q)).slice(0, 6)
  }, [buscaAluno, alunosDb])

  const handleAddVinculo = (aluno: any) => {
    if (vinculos.some(v => v.aluno_id === aluno.id)) return
    setVinculos(prev => [...prev, { aluno_id: aluno.id, nome: aluno.nome, turma: aluno.turma || '', foto: aluno.foto || aluno.dados?.foto || '', parentesco: 'Mãe', resp_pedagogico: false, resp_financeiro: false }])
    setBuscaAluno('')
  }
  const updVinculo = (id: string, field: string, val: any) =>
    setVinculos(prev => prev.map(v => v.aluno_id === id ? { ...v, [field]: val } : v))

  // ─── Save / Delete ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.nome.trim() || form.nome.trim().length < 2) { setError('Nome é obrigatório (mínimo 2 caracteres).'); return }
    setLoading(true); setError(null)
    try {
      const payload = {
        id: form.id || undefined,
        nome: form.nome.trim(),
        cpf: form.cpf.replace(/\D/g, '') || null,
        rg: form.rg || null, org_emissor: form.org_emissor || null,
        sexo: form.sexo || null, data_nasc: form.data_nasc || null,
        email: form.email || null, telefone: form.telefone || null, celular: form.celular || null,
        profissao: form.profissao || null, naturalidade: form.naturalidade || null,
        uf: form.uf || null, nacionalidade: form.nacionalidade || 'Brasileira',
        estado_civil: form.estado_civil || null, rfid: form.rfid || null,
        codigo: form.codigo || null, obs: form.obs || null, dados: {},
        endereco: { cep: form.cep, logradouro: form.logradouro, numero: form.numero, complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, estado: form.estado },
        alunos_vinculados: vinculos.map(v => ({ aluno_id: v.aluno_id, parentesco: v.parentesco, resp_pedagogico: v.resp_pedagogico, resp_financeiro: v.resp_financeiro })),
      }
      const res = await fetch('/api/responsaveis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Erro ao salvar.'); return }
      onSaved(json); onClose()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!form.id) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/responsaveis?id=${form.id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Erro ao excluir.') }
      onDeleted?.(form.id); onClose()
    } catch (e: any) { setError(e.message); setConfirmDelete(false) }
    finally { setDeleting(false) }
  }

  if (!isOpen) return null

  const isEdit = !!form.id
  const initials = form.nome.trim() ? form.nome.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>

        {/* ══════════ HEADER DARK ══════════ */}
        <div style={S.header}>
          <div style={S.headerGfx} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
            <div style={S.avatar}><span style={{ fontSize: 16, fontWeight: 900, color: '#a5b4fc' }}>{initials}</span></div>
            <div>
              <div style={S.hTitle}>{isEdit ? 'Editar Responsável' : 'Novo Responsável'}</div>
              <div style={S.hSub}>{isEdit ? `Código ${form.codigo || '—'}` : 'Preencha os dados do responsável'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 1 }}>
            {isEdit && !confirmDelete && (
              <button style={S.btnDanger} onClick={() => setConfirmDelete(true)} title="Excluir responsável">
                <Trash2 size={14} />
              </button>
            )}
            <button style={S.btnClose} onClick={onClose}><X size={15} strokeWidth={2.5} /></button>
          </div>
        </div>

        {/* ══════════ CONFIRM DELETE ══════════ */}
        {confirmDelete && (
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fef2f2', borderBottom:'1px solid #fecaca', padding:'10px 24px', flexShrink:0 }}>
            <AlertTriangle size={15} style={{ color:'#ef4444', flexShrink:0 }} />
            <span style={{ flex:1, fontSize:13, color:'#991b1b', fontWeight:500 }}>Excluir permanentemente <strong>{form.nome}</strong>?</span>
            <button style={{ background:'#ef4444', border:'none', color:'white', borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }} onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 size={12} style={{ animation:'spin .8s linear infinite' }} /> : null} Confirmar
            </button>
            <button style={{ background:'#f1f5f9', border:'none', color:'#475569', borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }} onClick={() => setConfirmDelete(false)}>Cancelar</button>
          </div>
        )}

        {/* ══════════ ERROR ══════════ */}
        {error && (
          <div style={{ display:'flex', alignItems:'center', gap:9, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, margin:'12px 24px 0', padding:'9px 14px', color:'#b91c1c', fontSize:13, fontWeight:500, flexShrink:0 }}>
            <AlertCircle size={14} style={{ flexShrink:0 }} /> <span>{error}</span>
          </div>
        )}

        {/* ══════════ BODY CLARO ══════════ */}
        <div style={S.body}>

          {/* ─── SEÇÃO 1: IDENTIFICAÇÃO ─────────────────────────────────── */}
          <div style={S.section}>
            <div style={SECTION_TITLE}>Identificação e Documentos</div>

            {/* Row 1: Nome (full) */}
            <Field label="Nome Completo *">
              <input style={inputStyle('nome')} {...focus('nome')} value={form.nome}
                onChange={upd('nome')} placeholder="Ex: Maria da Silva Souza" autoFocus />
            </Field>

            {/* Row 2: CPF · Sexo · Data Nasc · Estado Civil */}
            <div style={S.row4} className="resp-row">
              <Field label="CPF">
                <input style={inputStyle('cpf')} {...focus('cpf')} value={form.cpf}
                  onChange={e => setForm(p => ({ ...p, cpf: fmtCPF(e.target.value) }))}
                  placeholder="000.000.000-00" />
              </Field>
              <Field label="Sexo">
                <div style={{ position:'relative' }}>
                  <select style={selectStyle('sexo')} {...focus('sexo')} value={form.sexo} onChange={upd('sexo')}>
                    <option value="">Selecione</option>
                    <option value="F">Feminino</option>
                    <option value="M">Masculino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </Field>
              <Field label="Data de Nascimento">
                <input type="date" style={inputStyle('data_nasc')} {...focus('data_nasc')} value={form.data_nasc} onChange={upd('data_nasc')} />
              </Field>
              <Field label="Estado Civil">
                <select style={selectStyle('estado_civil')} {...focus('estado_civil')} value={form.estado_civil} onChange={upd('estado_civil')}>
                  <option value="">Selecione</option>
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viúvo(a)">Viúvo(a)</option>
                  <option value="União Estável">União Estável</option>
                </select>
              </Field>
            </div>

            {/* Row 3: RG · Org. Emissor · Naturalidade · UF · Nacionalidade */}
            <div style={{ display:'grid', gridTemplateColumns:'minmax(120px, 1fr) minmax(110px, 1fr) minmax(150px, 2fr) 60px minmax(130px, 1.2fr)', gap:'0 14px', marginTop: 12 }}>
              <Field label="RG">
                <input style={inputStyle('rg')} {...focus('rg')} value={form.rg} onChange={upd('rg')} placeholder="00.000.000-X" />
              </Field>
              <Field label="Org. Emissor RG">
                <input style={inputStyle('org_emissor')} {...focus('org_emissor')} value={form.org_emissor} onChange={upd('org_emissor')} placeholder="SSP/SP" />
              </Field>
              <Field label="Naturalidade">
                <input style={inputStyle('naturalidade')} {...focus('naturalidade')} value={form.naturalidade} onChange={upd('naturalidade')} placeholder="Cidade natal" />
              </Field>
              <Field label="UF">
                <input style={inputStyle('uf')} {...focus('uf')} value={form.uf} onChange={upd('uf')} placeholder="SP" maxLength={2} />
              </Field>
              <Field label="Nacionalidade">
                <input style={inputStyle('nacionalidade')} {...focus('nacionalidade')} value={form.nacionalidade} onChange={upd('nacionalidade')} placeholder="Brasileira" />
              </Field>
            </div>

            {/* Row 4: Profissão · RFID */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px', marginTop: 12 }}>
              <Field label="Profissão">
                <input style={inputStyle('profissao')} {...focus('profissao')} value={form.profissao} onChange={upd('profissao')} placeholder="Engenheiro, Professor..." />
              </Field>
              <Field label="RFID Card (Acesso)">
                <div style={{ position:'relative' }}>
                  <CreditCard size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }} />
                  <input style={{ ...inputStyle('rfid'), paddingLeft:34 }} {...focus('rfid')} value={form.rfid} onChange={upd('rfid')} placeholder="ID do cartão de acesso" />
                </div>
              </Field>
            </div>
          </div>

          {/* ─── SEÇÃO 2: CONTATO E LOCALIZAÇÃO ─────────────────────────── */}
          <div style={S.section}>
            <div style={SECTION_TITLE}>Contato e Localização</div>

            {/* Row: Celular · Email · Obs */}
            <div style={{ display:'grid', gridTemplateColumns:'180px 1fr 1fr', gap:'0 14px' }}>
              <Field label="Celular Principal">
                <input style={inputStyle('celular')} {...focus('celular')} value={form.celular}
                  onChange={e => setForm(p => ({ ...p, celular: fmtTel(e.target.value) }))} placeholder="(00) 90000-0000" />
              </Field>
              <Field label="E-mail Pessoal ou Empresarial">
                <input type="email" style={inputStyle('email')} {...focus('email')} value={form.email} onChange={upd('email')} placeholder="email@dominio.com" />
              </Field>
              <Field label="Observações Cadastrais">
                <input style={inputStyle('obs')} {...focus('obs')} value={form.obs} onChange={upd('obs')} placeholder="Detalhes, restrições ou horários..." />
              </Field>
            </div>

            {/* Row: CEP · Logradouro · Nº */}
            <div style={{ display:'grid', gridTemplateColumns:'120px 1fr 80px', gap:'0 14px', marginTop: 12 }}>
              <Field label="CEP">
                <input style={inputStyle('cep')} {...focus('cep')} value={form.cep}
                  onChange={e => setForm(p => ({ ...p, cep: fmtCEP(e.target.value) }))}
                  onBlur={e => buscarCEP(e.target.value)}
                  placeholder="00000-000" />
              </Field>
              <Field label="Logradouro">
                <input style={inputStyle('logradouro')} {...focus('logradouro')} value={form.logradouro} onChange={upd('logradouro')} placeholder="" />
              </Field>
              <Field label="Nº">
                <input style={inputStyle('numero')} {...focus('numero')} value={form.numero} onChange={upd('numero')} placeholder="" />
              </Field>
            </div>

            {/* Row: Complemento · Bairro · Cidade · UF */}
            <div style={{ display:'grid', gridTemplateColumns:'130px 1fr 1fr 90px', gap:'0 14px', marginTop: 12 }}>
              <Field label="Complemento">
                <input style={inputStyle('complemento')} {...focus('complemento')} value={form.complemento} onChange={upd('complemento')} placeholder="Apto..." />
              </Field>
              <Field label="Bairro">
                <input style={inputStyle('bairro')} {...focus('bairro')} value={form.bairro} onChange={upd('bairro')} />
              </Field>
              <Field label="Cidade">
                <input style={inputStyle('cidade')} {...focus('cidade')} value={form.cidade} onChange={upd('cidade')} />
              </Field>
              <Field label="UF">
                <select style={selectStyle('estado')} {...focus('estado')} value={form.estado} onChange={upd('estado')}>
                  <option value=""></option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => <option key={u}>{u}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* ─── SEÇÃO 3: VÍNCULOS ───────────────────────────────────────── */}
          <div style={S.section}>
            <div style={{ ...SECTION_TITLE, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>Vínculos com Alunos</span>
              {vinculos.length > 0 && (
                <span style={{ background:'#ede9fe', color:'#7c3aed', borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:800 }}>{vinculos.length}</span>
              )}
            </div>

            {/* Busca de aluno */}
            <div style={{ position:'relative', marginBottom: 12 }}>
              <Search size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }} />
              <input
                style={{ ...inputStyle('busca'), paddingLeft:34 }}
                {...focus('busca')}
                placeholder="Buscar aluno por nome ou matrícula para vincular..."
                value={buscaAluno}
                onChange={e => setBuscaAluno(e.target.value)}
              />
              {resultAlunos.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:10, boxShadow:'0 8px 32px rgba(0,0,0,0.1)', zIndex:50, overflow:'hidden' }}>
                  {resultAlunos.map(a => (
                    <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f8fafc', transition:'background .12s' }}
                      onClick={() => handleAddVinculo(a)}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <div style={{ width:40, height:40, borderRadius:'50%', background:'#ede9fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#7c3aed', flexShrink:0, overflow:'hidden' }}>
                        {a.foto || a.dados?.foto ? (
                          <img src={a.foto || a.dados?.foto} alt={a.nome} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        ) : a.nome.charAt(0)}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{a.nome}</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>{a.turma || ''} {a.codigo ? `· Cód. ${a.codigo}` : ''}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'#6366f1', background:'#ede9fe', borderRadius:6, padding:'3px 10px' }}>
                        <Plus size={11} /> Vincular
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de vínculos */}
            {vinculos.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'#cbd5e1', fontSize:13 }}>
                <GraduationCap size={28} style={{ opacity:.35, marginBottom:6 }} />
                <div style={{ fontWeight:600 }}>Nenhum aluno vinculado</div>
                <div style={{ fontSize:11, marginTop:2 }}>Use o campo acima para buscar e vincular</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {vinculos.map((v: any) => (
                  <div key={v.aluno_id} style={{ display:'flex', alignItems:'center', gap:14, background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:14, padding:'14px 18px' }}>
                    {/* Avatar Ultra Premium (Multiplicado ~3x) */}
                    <div style={{ width:84, height:84, borderRadius:'50%', background:'#ede9fe', border:'3px solid #c4b5fd', boxShadow:'0 6px 12px rgba(124,58,237,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:900, color:'#7c3aed', flexShrink:0, overflow:'hidden' }}>
                      {v.foto ? (
                        <img src={v.foto} alt={v.nome} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      ) : v.nome.charAt(0)}
                    </div>
                    {/* Info + Badges */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.nome}</div>
                      <div style={{ display:'flex', gap:5, marginTop:4, flexWrap:'wrap', alignItems:'center' }}>
                        {v.turma && <span style={BS.turma}>{v.turma}</span>}
                        {v.parentesco && <span style={BS.parentesco}>{v.parentesco}</span>}
                        {v.resp_financeiro && <span style={BS.financeiro}><Wallet size={9} /> Financeiro</span>}
                        {v.resp_pedagogico && <span style={BS.pedagogico}><BookOpen size={9} /> Pedagógico</span>}
                      </div>
                    </div>
                    {/* Controls */}
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                      <select
                        style={{ ...FIELD_SELECT, fontSize:12, padding:'5px 28px 5px 8px', borderColor:'#e2e8f0', borderRadius:7, minWidth:110 }}
                        value={v.parentesco || ''}
                        onChange={e => updVinculo(v.aluno_id, 'parentesco', e.target.value)}>
                        <option value="">Parentesco</option>
                        {PARENTESCO_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <button
                        title="Resp. Financeiro"
                        style={{ ...BtnToggle, ...(v.resp_financeiro ? BtnToggleAmber : {}) }}
                        onClick={() => updVinculo(v.aluno_id, 'resp_financeiro', !v.resp_financeiro)}>
                        <Wallet size={12} />
                      </button>
                      <button
                        title="Resp. Pedagógico"
                        style={{ ...BtnToggle, ...(v.resp_pedagogico ? BtnToggleGreen : {}) }}
                        onClick={() => updVinculo(v.aluno_id, 'resp_pedagogico', !v.resp_pedagogico)}>
                        <BookOpen size={12} />
                      </button>
                      <button
                        title="Remover vínculo"
                        style={BtnRemove}
                        onClick={() => setVinculos(prev => prev.filter(x => x.aluno_id !== v.aluno_id))}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══════════ FOOTER ══════════ */}
        <div style={S.footer}>
          <button style={S.btnCancel} onClick={onClose} disabled={loading || deleting}>Cancelar</button>
          <button style={S.btnSave} onClick={handleSave} disabled={loading || deleting}>
            {loading
              ? <><Loader2 size={14} style={{ animation:'spin .8s linear infinite' }} /> Salvando...</>
              : <><Save size={14} /> {isEdit ? 'Salvar Alterações' : 'Criar Responsável'}</>
            }
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes respFade { from{opacity:0} to{opacity:1} }
        @keyframes respSlide { from{opacity:0;transform:translateY(20px) scale(0.98)} to{opacity:1;transform:none} }
        .resp-row > div { margin-bottom: 0; }
      `}</style>
    </div>
  )
}

// ─── Badge styles ──────────────────────────────────────────────────────────────
const BS: Record<string, React.CSSProperties> = {
  turma:      { background:'#f1f5f9', color:'#475569', border:'1px solid #e2e8f0', borderRadius:5, padding:'2px 7px', fontSize:10, fontWeight:700 },
  parentesco: { background:'#ede9fe', color:'#7c3aed', border:'1px solid #c4b5fd', borderRadius:5, padding:'2px 7px', fontSize:10, fontWeight:700 },
  financeiro: { background:'#fffbeb', color:'#d97706', border:'1px solid #fde68a', borderRadius:5, padding:'2px 7px', fontSize:10, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 } as React.CSSProperties,
  pedagogico: { background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:5, padding:'2px 7px', fontSize:10, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 } as React.CSSProperties,
}
const BtnToggle: React.CSSProperties = { background:'#f1f5f9', border:'1.5px solid #e2e8f0', color:'#94a3b8', borderRadius:7, padding:'5px 7px', cursor:'pointer', display:'flex', alignItems:'center', transition:'all .15s' }
const BtnToggleAmber: React.CSSProperties = { background:'#fffbeb', border:'1.5px solid #fde68a', color:'#d97706' }
const BtnToggleGreen: React.CSSProperties = { background:'#f0fdf4', border:'1.5px solid #bbf7d0', color:'#16a34a' }
const BtnRemove: React.CSSProperties = { background:'#fef2f2', border:'1.5px solid #fecaca', color:'#ef4444', borderRadius:7, padding:'5px 7px', cursor:'pointer', display:'flex', alignItems:'center', transition:'all .15s' }

// ─── Layout styles ─────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  overlay: {
    position:'fixed', inset:0, zIndex:10000,
    background:'rgba(15,23,42,0.6)', backdropFilter:'blur(8px)',
    display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    animation:'respFade .2s ease',
  },
  modal: {
    background:'#f8fafc', border:'1px solid #e2e8f0',
    borderRadius:18, width:'min(820px,100%)', maxHeight:'92vh',
    display:'flex', flexDirection:'column',
    boxShadow:'0 32px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.04)',
    animation:'respSlide .28s cubic-bezier(.16,1,.3,1)', overflow:'hidden',
  },
  // ── Header dark (como na imagem 1)
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'20px 24px', flexShrink:0,
    background:'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    position:'relative', overflow:'hidden',
  },
  headerGfx: {
    position:'absolute', inset:0, pointerEvents:'none',
    background:'radial-gradient(ellipse 80% 140% at 0% 0%, rgba(99,102,241,0.15) 0%, transparent 60%)',
  },
  avatar: {
    width:46, height:46, borderRadius:12, flexShrink:0,
    background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.3)',
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  hTitle: { fontSize:18, fontWeight:800, color:'#f8fafc', letterSpacing:'-0.01em', fontFamily:"'Outfit',sans-serif" },
  hSub:   { fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:500, marginTop:2 },
  btnClose: {
    background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:9, color:'rgba(255,255,255,0.5)', cursor:'pointer', padding:7,
    display:'flex', alignItems:'center',
  },
  btnDanger: {
    background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
    borderRadius:9, color:'rgba(239,68,68,0.7)', cursor:'pointer', padding:7,
    display:'flex', alignItems:'center',
  },
  body: {
    flex:1, overflowY:'auto', overflowX:'hidden',
    padding:'20px 24px', display:'flex', flexDirection:'column', gap:0,
    background:'#f8fafc',
  },
  section: {
    background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:12,
    padding:'18px 20px', marginBottom:14, display:'flex', flexDirection:'column', gap:12,
  },
  row4: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'0 14px' },
  row6: { display:'grid', gridTemplateColumns:'110px 110px 1fr 1fr 100px', gap:'0 14px' },
  footer: {
    display:'flex', justifyContent:'flex-end', gap:10,
    padding:'14px 24px', borderTop:'1px solid #e2e8f0', flexShrink:0,
    background:'#fff',
  },
  btnCancel: {
    background:'#f1f5f9', border:'1.5px solid #e2e8f0', color:'#475569',
    padding:'9px 20px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer',
  },
  btnSave: {
    display:'flex', alignItems:'center', gap:8,
    background:'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    border:'none', color:'white', padding:'9px 22px', borderRadius:9,
    fontSize:13, fontWeight:700, cursor:'pointer',
    boxShadow:'0 4px 14px rgba(79,70,229,0.3)',
  },
}
