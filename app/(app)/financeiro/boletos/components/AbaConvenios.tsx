'use client'

import React from 'react'
import { ConfigConvenio } from '@/lib/dataContext'
import { X } from 'lucide-react'

interface Props {
  convenios: ConfigConvenio[]
  onSave: (conv: ConfigConvenio) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
}

const BANCOS = [
  { codigo: '341', nome: 'Itaú Unibanco' },
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '260', nome: 'Nu Pagamentos (Nubank)' },
]

const EMPTY: Omit<ConfigConvenio, 'id' | 'createdAt'> = {
  banco: '341', nomeBanco: 'Itaú Unibanco',
  agencia: '',
  conta: '', digitoConta: '',
  convenio: '', cedente: '', cnpj: '', carteira: '109',
  instrucoes: '', nossoNumeroInicial: 1, nossoNumeroSequencial: 0,
  situacao: 'ativo', ambiente: 'homologacao',
}

function newId() { return `CONV-${Date.now().toString(36).toUpperCase()}` }

export function AbaConvenios({ convenios, onSave, onDelete, onToggle }: Props) {
  const [form, setForm] = React.useState<Partial<ConfigConvenio>>({})
  const [editing, setEditing] = React.useState(false)
  const [showForm, setShowForm] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null)

  function openNew() {
    setForm({ ...EMPTY, id: newId(), createdAt: new Date().toISOString() })
    setEditing(false)
    setShowForm(true)
  }

  function openEdit(c: ConfigConvenio) {
    setForm({ ...c })
    setEditing(true)
    setShowForm(true)
  }

  function handleBanco(codigo: string) {
    const b = BANCOS.find(x => x.codigo === codigo)
    setForm(f => ({ ...f, banco: codigo, nomeBanco: b?.nome ?? '' }))
  }

  function save() {
    if (!form.agencia || !form.conta || !form.cedente || !form.cnpj || !form.convenio) {
      alert('Preencha todos os campos obrigatórios.')
      return
    }
    onSave(form as ConfigConvenio)
    setShowForm(false)
  }

  const inp = (label: string, field: keyof ConfigConvenio, required = false, placeholder = '') => (
    <div>
      <label className="form-label">{label}{required && <span style={{ color: '#f87171' }}> *</span>}</label>
      <input
        className="form-input"
        value={(form[field] as string | number) ?? ''}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 18 }}>Convênios Bancários</h2>
          <p className="page-subtitle">Configure os dados bancários para emissão de boletos registrados</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Novo Convênio</button>
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{editing ? 'Editar Convênio' : 'Novo Convênio'}</div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowForm(false)}><X size={16} /></button>
          </div>

          {/* Banco + Cedente */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label className="form-label">Banco <span style={{ color: '#f87171' }}>*</span></label>
              <select className="form-input" value={form.banco ?? '341'} onChange={e => handleBanco(e.target.value)}>
                {BANCOS.map(b => <option key={b.codigo} value={b.codigo}>{b.codigo} — {b.nome}</option>)}
              </select>
            </div>
            {inp('Cedente (Razão Social)', 'cedente', true, 'Nome da escola')}
          </div>

          {/* CNPJ + Agência + DV + Conta + DV */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.6fr', gap: 12, marginBottom: 16 }}>
            {inp('CNPJ (só dígitos)', 'cnpj', true, '00000000000000')}
            {inp('Agência', 'agencia', true, '0001')}
            {inp('Conta', 'conta', true, '12345')}
            {inp('DV Conta', 'digitoConta', false, '6')}
          </div>

          {/* Convênio + Carteira + Seq + Ambiente */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            {inp('Cód. Beneficiário (Convênio)', 'convenio', true, 'Ex: 34022-6')}
            <div>
              <label className="form-label">Carteira</label>
              <select className="form-input" value={form.carteira ?? '109'} onChange={e => setForm(f => ({ ...f, carteira: e.target.value }))}>
                {['109', '112', '175'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {inp('Nosso Nº Inicial', 'nossoNumeroInicial', false, '1')}
            <div>
              <label className="form-label">Ambiente</label>
              <select className="form-input" value={form.ambiente ?? 'homologacao'} onChange={e => setForm(f => ({ ...f, ambiente: e.target.value as 'producao' | 'homologacao' }))}>
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
            </div>
          </div>

          {/* Instrução */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Instrução Padrão</label>
            <textarea
              className="form-input"
              rows={2}
              value={form.instrucoes ?? ''}
              onChange={e => setForm(f => ({ ...f, instrucoes: e.target.value }))}
              placeholder="Ex: Não receber após o vencimento. Cobrar juros de 0,033% ao dia."
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={save}>{editing ? 'Salvar Alterações' : 'Criar Convênio'}</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {convenios.length === 0 && !showForm ? (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🏦</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nenhum convênio cadastrado</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Crie um convênio bancário para emitir boletos registrados.</div>
          <button className="btn btn-primary" onClick={openNew}>+ Novo Convênio</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {convenios.map(c => (
            <div key={c.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Banco badge */}
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: c.banco === '341' ? 'rgba(236,112,0,0.1)' : 'rgba(59,130,246,0.1)',
                border: `1px solid ${c.banco === '341' ? 'rgba(236,112,0,0.25)' : 'rgba(59,130,246,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 900,
                color: c.banco === '341' ? '#ec7000' : '#3b82f6',
              }}>
                {c.banco}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.cedente}</span>
                  <span className={`badge ${c.situacao === 'ativo' ? 'badge-success' : 'badge-secondary'}`}>
                    {c.situacao === 'ativo' ? '● Ativo' : '○ Inativo'}
                  </span>
                  {c.ambiente === 'homologacao' && (
                    <span className="badge badge-warning">Homologação</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'hsl(var(--text-muted))', flexWrap: 'wrap' }}>
                  <span>Ag: <strong>{c.agencia}</strong></span>
                  <span>Conta: <strong>{c.conta}{c.digitoConta ? '-' + c.digitoConta : ''}</strong></span>
                  <span>Conv: <strong>{c.convenio}</strong></span>
                  <span>Cart: <strong>{c.carteira}</strong></span>
                  <span>Seq: <strong>{c.nossoNumeroSequencial}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => onToggle(c.id)}>
                  {c.situacao === 'ativo' ? 'Desativar' : 'Ativar'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Editar</button>
                <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmDelete(c.id)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ padding: 32, maxWidth: 400, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Excluir Convênio?</h3>
            <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 24 }}>Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { onDelete(confirmDelete); setConfirmDelete(null) }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
