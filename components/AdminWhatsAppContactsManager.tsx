'use client'

import React, { useState } from 'react'
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  MessageCircle,
  Phone,
  Building2,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CheckCircle2,
  Eye
} from 'lucide-react'
import { toast } from 'sonner'

const SETOR_PRESETS = [
  'Secretaria Escolar',
  'Coordenação Pedagógica',
  'Financeiro',
  'Matrículas & Comercial',
  'Direção',
  'Suporte Técnico'
]

function formatPhoneBR(value: string) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

function getWhatsAppUrl(phone: string, nome: string) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return '#'
  const full = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
  const text = encodeURIComponent(`Olá, ${nome || 'Atendimento'}! Gostaria de falar com a escola pela Agenda Digital.`)
  return `https://wa.me/${full}?text=${text}`
}

export function AdminWhatsAppContactsManager({ localConfig, setLocalConfig, onSave }: any) {
  const contatos: any[] = localConfig.contatosWhatsapp || []
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    id: '',
    nome: '',
    setor: '',
    telefone: '',
    descricao: '',
    ativo: true,
    ordem: 0
  })

  const updateContacts = (newContacts: any[], msg?: string) => {
    const newConfig = { ...localConfig, contatosWhatsapp: newContacts }
    setLocalConfig(newConfig)
    if (onSave) onSave(newConfig)
    if (msg) toast.success(msg)
  }

  const handleAdd = () => {
    const newId = Date.now().toString()
    const newContact = {
      id: newId,
      nome: '',
      setor: 'Secretaria Escolar',
      telefone: '',
      descricao: 'Atendimento rápido para famílias e responsáveis',
      ativo: true,
      ordem: contatos.length || 0
    }
    const newContacts = [...contatos, newContact]
    updateContacts(newContacts)
    setIsEditing(newId)
    setEditForm(newContact)
  }

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!editForm.nome.trim()) {
      toast.error('Informe o nome do canal ou responsável pelo atendimento.')
      return
    }
    const newContacts = contatos.map((c: any) => (c.id === editForm.id ? editForm : c))
    updateContacts(newContacts, 'Canal de WhatsApp salvo com sucesso!')
    setIsEditing(null)
  }

  const handleCancelEdit = (contato: any) => {
    if (!contato.nome?.trim() && !contato.telefone?.trim()) {
      const filtered = contatos.filter((c: any) => c.id !== contato.id)
      updateContacts(filtered)
    }
    setIsEditing(null)
  }

  const handleDelete = (id: string) => {
    const newContacts = contatos.filter((c: any) => c.id !== id)
    updateContacts(newContacts, 'Contato removido.')
  }

  const handleToggle = (id: string, currentStatus: boolean) => {
    const newContacts = contatos.map((c: any) => (c.id === id ? { ...c, ativo: !currentStatus } : c))
    updateContacts(
      newContacts,
      !currentStatus ? 'Canal ativado no menu flutuante!' : 'Canal ocultado do menu flutuante.'
    )
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === contatos.length - 1)) return
    const newArray = [...contatos]
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    const temp = newArray[index]
    newArray[index] = newArray[targetIdx]
    newArray[targetIdx] = temp
    const reordered = newArray.map((c, i) => ({ ...c, ordem: i }))
    updateContacts(reordered, 'Ordem de exibição atualizada!')
  }

  const ativosCount = contatos.filter((c: any) => c.ativo).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <style dangerouslySetInnerHTML={{__html: `
        .ad-wa-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 1080px) {
          .ad-wa-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 768px) {
          .ad-wa-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
            padding: 18px 16px !important;
          }
          .ad-wa-header-btn {
            width: 100% !important;
            justify-content: center !important;
            min-height: 48px !important;
          }
          .ad-wa-body {
            padding: 16px !important;
          }
          .ad-wa-edit-inputs {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .ad-wa-edit-inputs input {
            font-size: 16px !important;
            min-height: 48px !important;
          }
          .ad-wa-contact-card {
            flex-direction: column !important;
          }
          .ad-wa-order-rail {
            flex-direction: row !important;
            border-right: none !important;
            border-bottom: 1px solid #e2e8f0 !important;
            padding: 8px 14px !important;
            justify-content: space-between !important;
          }
          .ad-wa-contact-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }
          .ad-wa-contact-actions {
            width: 100% !important;
            justify-content: space-between !important;
            border-top: 1px solid #f1f5f9;
            padding-top: 12px !important;
          }
        }
      `}} />

      {/* Header */}
      <div
        className="ad-wa-header"
        style={{
          padding: '24px 32px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          background: 'linear-gradient(180deg, rgba(240, 253, 244, 0.55) 0%, rgba(255, 255, 255, 0) 100%)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}
            >
              <MessageCircle size={19} />
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
              Central de Canais WhatsApp
            </h3>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 20,
                background: ativosCount > 0 ? '#dcfce7' : '#f1f5f9',
                color: ativosCount > 0 ? '#166534' : '#64748b',
                border: `1px solid ${ativosCount > 0 ? '#bbf7d0' : '#e2e8f0'}`
              }}
            >
              {ativosCount} {ativosCount === 1 ? 'canal ativo' : 'canais ativos'}
            </span>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13.5 }}>
            Configure os setores e números de atendimento rápido exibidos no botão flutuante do WhatsApp para as famílias.
          </p>
        </div>

        <button
          type="button"
          className="ad-wa-header-btn"
          onClick={handleAdd}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            border: 'none',
            padding: '11px 20px',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 13.5,
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.28)',
            flexShrink: 0
          }}
        >
          <Plus size={17} /> Novo Canal de Atendimento
        </button>
      </div>

      {/* Body */}
      <div className="ad-wa-body" style={{ padding: 28 }}>
        <div className="ad-wa-grid">
          {/* Lista de Contatos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {contatos.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
                  borderRadius: 18,
                  border: '1.5px dashed #cbd5e1'
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px'
                  }}
                >
                  <MessageCircle size={28} />
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                  Nenhum canal de WhatsApp configurado
                </h4>
                <p style={{ color: '#64748b', fontSize: 13, maxWidth: 380, margin: '0 auto 20px', lineHeight: 1.5 }}>
                  Adicione números da Secretaria, Financeiro ou Coordenação para que os responsáveis iniciem conversas com 1 toque.
                </p>
                <button
                  type="button"
                  onClick={handleAdd}
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13.5
                  }}
                >
                  <Plus size={16} /> Criar Primeiro Canal
                </button>
              </div>
            ) : (
              contatos.map((contato: any, index: number) => {
                const editingThis = isEditing === contato.id
                return (
                  <div
                    key={contato.id}
                    className="ad-wa-contact-card"
                    style={{
                      display: 'flex',
                      border: editingThis ? '2px solid #10b981' : '1.5px solid #e2e8f0',
                      borderRadius: 16,
                      overflow: 'hidden',
                      background: '#ffffff',
                      boxShadow: editingThis
                        ? '0 8px 24px rgba(16, 185, 129, 0.12)'
                        : '0 2px 8px rgba(15, 23, 42, 0.03)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Order rail */}
                    <div
                      className="ad-wa-order-rail"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '12px 10px',
                        background: '#f8fafc',
                        borderRight: '1px solid #e2e8f0',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                        title="Mover para cima"
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                          opacity: index === 0 ? 0.35 : 1,
                          color: '#475569'
                        }}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>#{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 'down')}
                        disabled={index === contatos.length - 1}
                        title="Mover para baixo"
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: index === contatos.length - 1 ? 'not-allowed' : 'pointer',
                          opacity: index === contatos.length - 1 ? 0.35 : 1,
                          color: '#475569'
                        }}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, padding: 20, minWidth: 0 }}>
                      {editingThis ? (
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Editando Canal de Atendimento
                            </span>
                          </div>

                          {/* Quick Setor Chips */}
                          <div>
                            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                              Sugestões rápidas de setor:
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {SETOR_PRESETS.map(preset => {
                                const selected = editForm.setor === preset
                                return (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setEditForm(prev => ({ ...prev, setor: preset, nome: prev.nome || preset }))}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 20,
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      border: selected ? '1.5px solid #10b981' : '1px solid #cbd5e1',
                                      background: selected ? '#ecfdf5' : '#f8fafc',
                                      color: selected ? '#047857' : '#475569'
                                    }}
                                  >
                                    {preset}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          <div
                            className="ad-wa-edit-inputs"
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}
                          >
                            <div>
                              <label
                                htmlFor={`wa-setor-${contato.id}`}
                                style={{ fontSize: 12, marginBottom: 4, display: 'block', fontWeight: 700, color: '#334155' }}
                              >
                                Setor / Departamento
                              </label>
                              <input
                                id={`wa-setor-${contato.id}`}
                                type="text"
                                value={editForm.setor || ''}
                                onChange={e => setEditForm({ ...editForm, setor: e.target.value })}
                                placeholder="Ex: Coordenação"
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 10,
                                  fontSize: 13.5,
                                  color: '#0f172a',
                                  background: '#f8fafc',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`wa-nome-${contato.id}`}
                                style={{ fontSize: 12, marginBottom: 4, display: 'block', fontWeight: 700, color: '#334155' }}
                              >
                                Nome de Exibição *
                              </label>
                              <input
                                id={`wa-nome-${contato.id}`}
                                type="text"
                                required
                                value={editForm.nome}
                                onChange={e => setEditForm({ ...editForm, nome: e.target.value })}
                                placeholder="Ex: Secretaria Colégio Impacto"
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 10,
                                  fontSize: 13.5,
                                  color: '#0f172a',
                                  background: '#f8fafc',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`wa-tel-${contato.id}`}
                                style={{ fontSize: 12, marginBottom: 4, display: 'block', fontWeight: 700, color: '#334155' }}
                              >
                                WhatsApp (com DDD) *
                              </label>
                              <input
                                id={`wa-tel-${contato.id}`}
                                type="tel"
                                inputMode="tel"
                                autoCorrect="off"
                                value={editForm.telefone}
                                onChange={e => setEditForm({ ...editForm, telefone: formatPhoneBR(e.target.value) })}
                                placeholder="(11) 99999-9999"
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 10,
                                  fontSize: 13.5,
                                  color: '#0f172a',
                                  background: '#f8fafc',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor={`wa-desc-${contato.id}`}
                              style={{ fontSize: 12, marginBottom: 4, display: 'block', fontWeight: 700, color: '#334155' }}
                            >
                              Descrição / Orientação para os Pais (Opcional)
                            </label>
                            <input
                              id={`wa-desc-${contato.id}`}
                              type="text"
                              value={editForm.descricao}
                              onChange={e => setEditForm({ ...editForm, descricao: e.target.value })}
                              placeholder="Ex: Dúvidas sobre matrículas, documentos e declarações"
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #cbd5e1',
                                borderRadius: 10,
                                fontSize: 13.5,
                                color: '#0f172a',
                                background: '#f8fafc',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                            <button
                              type="button"
                              onClick={() => handleCancelEdit(contato)}
                              style={{
                                padding: '9px 16px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: 10,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontWeight: 700,
                                fontSize: 13,
                                color: '#475569'
                              }}
                            >
                              <X size={15} /> Cancelar
                            </button>
                            <button
                              type="submit"
                              style={{
                                padding: '9px 18px',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: 10,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontWeight: 800,
                                fontSize: 13,
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                              }}
                            >
                              <Check size={15} /> Confirmar Canal
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="ad-wa-contact-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                              <h4 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: '#0f172a' }}>
                                {contato.nome || 'Canal sem nome'}
                              </h4>
                              {contato.setor && (
                                <span
                                  style={{
                                    fontSize: 11.5,
                                    padding: '2px 10px',
                                    borderRadius: 20,
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1px solid #bfdbfe',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                >
                                  <Building2 size={11} /> {contato.setor}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: 11.5,
                                  padding: '2px 10px',
                                  borderRadius: 20,
                                  background: contato.ativo ? '#dcfce7' : '#f1f5f9',
                                  color: contato.ativo ? '#166534' : '#64748b',
                                  fontWeight: 700
                                }}
                              >
                                {contato.ativo ? '● Visível no App' : '○ Oculto'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: contato.descricao ? 4 : 0 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <Phone size={13} color="#10b981" />
                                {contato.telefone || 'Sem número informado'}
                              </span>
                              {contato.telefone && (
                                <a
                                  href={getWhatsAppUrl(contato.telefone, contato.nome)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    color: '#059669',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                >
                                  Testar link <ExternalLink size={11} />
                                </a>
                              )}
                            </div>

                            {contato.descricao && (
                              <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.4 }}>{contato.descricao}</div>
                            )}
                          </div>

                          <div className="ad-wa-contact-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <label
                              style={{ position: 'relative', display: 'inline-block', width: 46, height: 26, cursor: 'pointer', flexShrink: 0 }}
                              title={contato.ativo ? 'Desativar canal' : 'Ativar canal'}
                            >
                              <input
                                type="checkbox"
                                style={{ opacity: 0, width: 0, height: 0 }}
                                checked={contato.ativo}
                                onChange={() => handleToggle(contato.id, contato.ativo)}
                              />
                              <span
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: contato.ativo ? '#10b981' : '#cbd5e1',
                                  borderRadius: 26,
                                  transition: '.3s'
                                }}
                              >
                                <span
                                  style={{
                                    position: 'absolute',
                                    height: 20,
                                    width: 20,
                                    left: 3,
                                    bottom: 3,
                                    background: 'white',
                                    transition: '.3s',
                                    borderRadius: '50%',
                                    transform: contato.ativo ? 'translateX(20px)' : 'none',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                                  }}
                                />
                              </span>
                            </label>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditing(contato.id)
                                  setEditForm(contato)
                                }}
                                style={{
                                  border: '1px solid #e2e8f0',
                                  background: '#f8fafc',
                                  color: '#4f46e5',
                                  cursor: 'pointer',
                                  padding: '8px 12px',
                                  borderRadius: 10,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12.5,
                                  fontWeight: 700
                                }}
                                title="Editar"
                              >
                                <Edit2 size={14} /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(contato.id)}
                                style={{
                                  border: '1px solid #fee2e2',
                                  background: '#fef2f2',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '8px 10px',
                                  borderRadius: 10,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Excluir"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Simulador Flutuante do WhatsApp (Preview em Tempo Real) */}
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: 18,
              padding: 20,
              position: 'sticky',
              top: 20
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Eye size={15} color="#059669" />
              <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                Simulação no App da Família
              </span>
            </div>

            <div
              style={{
                background: '#ffffff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.06)'
              }}
            >
              {/* Widget Header */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <MessageCircle size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>Atendimento via WhatsApp</div>
                  <div style={{ fontSize: 11, opacity: 0.9 }}>Escolha o setor para iniciar a conversa</div>
                </div>
              </div>

              {/* Widget List */}
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contatos.filter((c: any) => c.ativo).length === 0 ? (
                  <div style={{ padding: '20px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                    Nenhum canal ativo no momento.
                  </div>
                ) : (
                  contatos
                    .filter((c: any) => c.ativo)
                    .map((c: any) => (
                      <div
                        key={c.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.nome || 'Atendimento'}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.setor || c.descricao || c.telefone || 'Clique para conversar'}
                          </div>
                        </div>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: '#dcfce7',
                            color: '#059669',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <ExternalLink size={13} />
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
